"""Graph construction and frozen GAT migrated from the existing inference service.
Source SHA-256: 5e15f000f8950cab95642d5f1dc345cc2e07232c32618ffdaac269b880883189
No inference service imports or downloads run on module import.
"""
from __future__ import annotations
import json
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from PIL import Image
import torch
from torch import nn
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import GATv2Conv, global_mean_pool
import logging
logger = logging.getLogger(__name__)


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

class DinoPreprocessor:

    def __init__(self, image_size: int=224):
        self.image_size = image_size
        self.resize_size = int(image_size * 256 / 224)

    def __call__(self, image: Image.Image) -> torch.Tensor:
        image = image.convert('RGB')
        w, h = image.size
        scale = self.resize_size / min(w, h)
        new_w = max(1, round(w * scale))
        new_h = max(1, round(h * scale))
        image = image.resize((new_w, new_h), Image.Resampling.BICUBIC)
        left = (new_w - self.image_size) // 2
        top = (new_h - self.image_size) // 2
        image = image.crop((left, top, left + self.image_size, top + self.image_size))
        arr = np.asarray(image).astype(np.float32) / 255.0
        arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
        tensor = torch.from_numpy(arr.transpose(2, 0, 1)).float()
        return tensor

@dataclass
class GraphConfig:
    containment_threshold: float = 0.8
    containment_min_area_ratio: float = 1.15
    alignment_tolerance: float = 0.02
    large_box_width_ratio: float = 0.85
    large_box_height_ratio: float = 0.85
    row_overlap_threshold: float = 0.5
    row_center_tolerance: float = 0.035
    column_overlap_threshold: float = 0.5
    column_center_tolerance: float = 0.035
    overlap_iou_threshold: float = 0.2
    proximity_distance_threshold: float = 0.15
    reading_order_row_tolerance: float = 0.035
    enable_connectivity_fallback: bool = True
    min_valid_box_size: float = 0.001

@dataclass
class GraphSchema:
    class_names: List[str]
    num_classes: int
    node_feature_names: List[str]
    node_feature_dim: int
    edge_relation_names: List[str]
    edge_continuous_names: List[str]
    edge_feature_dim: int
    graph_config: Dict[str, Any]
    schema_version: str = '1.0'

    @staticmethod
    def load(path: str):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return GraphSchema(**data)
EDGE_RELATION_NAMES = ['contains', 'inside', 'left_aligned', 'right_aligned', 'top_aligned', 'bottom_aligned', 'horizontal_center_aligned', 'vertical_center_aligned', 'same_row', 'same_column', 'overlap', 'reading_order', 'controlled_proximity', 'connectivity_fallback']
NUM_RELATIONS = len(EDGE_RELATION_NAMES)
EDGE_CONTINUOUS_NAMES = ['norm_center_distance', 'angle_sin', 'angle_cos']
NODE_NUMERIC_NAMES = ['norm_center_x', 'norm_center_y', 'norm_width', 'norm_height', 'norm_area', 'confidence']

class Box:
    __slots__ = ('x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'w', 'h', 'area')

    def __init__(self, x1, y1, x2, y2):
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.cx = (x1 + x2) / 2.0
        self.cy = (y1 + y2) / 2.0
        self.w = max(x2 - x1, 0.0)
        self.h = max(y2 - y1, 0.0)
        self.area = self.w * self.h

def intersection_area(a: Box, b: Box) -> float:
    ix1 = max(a.x1, b.x1)
    iy1 = max(a.y1, b.y1)
    ix2 = min(a.x2, b.x2)
    iy2 = min(a.y2, b.y2)
    return max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)

def box_iou(a: Box, b: Box) -> float:
    intersection = intersection_area(a, b)
    union = a.area + b.area - intersection
    return intersection / union if union > 0 else 0.0

def directed_containment(a: Box, b: Box, cfg: GraphConfig) -> bool:
    if b.area <= 0:
        return False
    intersection = intersection_area(a, b)
    coverage = intersection / b.area
    return coverage >= cfg.containment_threshold and a.area >= b.area * cfg.containment_min_area_ratio

def alignment_flags(a: Box, b: Box, cfg: GraphConfig):
    a_wide = a.w >= cfg.large_box_width_ratio
    b_wide = b.w >= cfg.large_box_width_ratio
    a_tall = a.h >= cfg.large_box_height_ratio
    b_tall = b.h >= cfg.large_box_height_ratio
    tolerance = cfg.alignment_tolerance
    flags = {'left_aligned': False, 'right_aligned': False, 'top_aligned': False, 'bottom_aligned': False, 'horizontal_center_aligned': False, 'vertical_center_aligned': False}
    if not (a_wide or b_wide):
        flags['left_aligned'] = abs(a.x1 - b.x1) <= tolerance
        flags['right_aligned'] = abs(a.x2 - b.x2) <= tolerance
        flags['horizontal_center_aligned'] = abs(a.cx - b.cx) <= tolerance
    if not (a_tall or b_tall):
        flags['top_aligned'] = abs(a.y1 - b.y1) <= tolerance
        flags['bottom_aligned'] = abs(a.y2 - b.y2) <= tolerance
        flags['vertical_center_aligned'] = abs(a.cy - b.cy) <= tolerance
    return flags

def vertical_overlap_ratio(a: Box, b: Box):
    iy1 = max(a.y1, b.y1)
    iy2 = min(a.y2, b.y2)
    overlap = max(0.0, iy2 - iy1)
    minimum = max(min(a.h, b.h), 1e-06)
    return overlap / minimum

def horizontal_overlap_ratio(a: Box, b: Box):
    ix1 = max(a.x1, b.x1)
    ix2 = min(a.x2, b.x2)
    overlap = max(0.0, ix2 - ix1)
    minimum = max(min(a.w, b.w), 1e-06)
    return overlap / minimum

def same_row(a: Box, b: Box, cfg: GraphConfig):
    return vertical_overlap_ratio(a, b) >= cfg.row_overlap_threshold and abs(a.cy - b.cy) <= cfg.row_center_tolerance

def same_column(a: Box, b: Box, cfg: GraphConfig):
    return horizontal_overlap_ratio(a, b) >= cfg.column_overlap_threshold and abs(a.cx - b.cx) <= cfg.column_center_tolerance

def reading_order_edges(boxes: List[Box], cfg: GraphConfig):
    if not boxes:
        return []
    ordered = sorted(range(len(boxes)), key=lambda i: boxes[i].cy)
    rows = []
    current = [ordered[0]]
    current_y = boxes[ordered[0]].cy
    for idx in ordered[1:]:
        y = boxes[idx].cy
        if abs(y - current_y) <= cfg.reading_order_row_tolerance:
            current.append(idx)
        else:
            rows.append(current)
            current = [idx]
            current_y = y
    rows.append(current)
    final_order = []
    for row in rows:
        final_order.extend(sorted(row, key=lambda i: boxes[i].cx))
    return list(zip(final_order[:-1], final_order[1:]))

def empty_graph(schema: GraphSchema):
    data = Data(x=torch.zeros((0, schema.node_feature_dim), dtype=torch.float32), edge_index=torch.zeros((2, 0), dtype=torch.long), edge_attr=torch.zeros((0, schema.edge_feature_dim), dtype=torch.float32), num_nodes=0)
    data.is_empty = True
    return data

def build_ui_graph(detections: List[Dict[str, Any]], image_width: int, image_height: int, schema: GraphSchema, graph_cfg: GraphConfig):
    if not detections:
        return empty_graph(schema)
    boxes = []
    class_onehots = []
    confidences = []
    for detection in detections:
        x1, y1, x2, y2 = detection['bbox']
        nx1 = x1 / image_width
        ny1 = y1 / image_height
        nx2 = x2 / image_width
        ny2 = y2 / image_height
        nx1 = np.clip(nx1, 0.0, 1.0)
        ny1 = np.clip(ny1, 0.0, 1.0)
        nx2 = np.clip(nx2, 0.0, 1.0)
        ny2 = np.clip(ny2, 0.0, 1.0)
        width = nx2 - nx1
        height = ny2 - ny1
        if width < graph_cfg.min_valid_box_size or height < graph_cfg.min_valid_box_size:
            continue
        class_id = int(detection['class_id'])
        if not 0 <= class_id < schema.num_classes:
            continue
        onehot = np.zeros(schema.num_classes, dtype=np.float32)
        onehot[class_id] = 1.0
        boxes.append(Box(nx1, ny1, nx2, ny2))
        class_onehots.append(onehot)
        confidences.append(float(detection['confidence']))
    n = len(boxes)
    if n == 0:
        return empty_graph(schema)
    node_features = np.zeros((n, schema.node_feature_dim), dtype=np.float32)
    for i in range(n):
        box = boxes[i]
        numeric = np.array([box.cx, box.cy, box.w, box.h, box.area, confidences[i]], dtype=np.float32)
        node_features[i] = np.concatenate([class_onehots[i], numeric])
    edge_relations = {}

    def relation_vector(u, v):
        key = (u, v)
        if key not in edge_relations:
            edge_relations[key] = np.zeros(NUM_RELATIONS, dtype=np.float32)
        return edge_relations[key]

    def set_relation(u, v, name):
        vector = relation_vector(u, v)
        vector[EDGE_RELATION_NAMES.index(name)] = 1.0
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            a = boxes[i]
            b = boxes[j]
            if directed_containment(a, b, graph_cfg):
                set_relation(i, j, 'contains')
                set_relation(j, i, 'inside')
            flags = alignment_flags(a, b, graph_cfg)
            for name, value in flags.items():
                if value:
                    set_relation(i, j, name)
                    set_relation(j, i, name)
            if same_row(a, b, graph_cfg):
                set_relation(i, j, 'same_row')
                set_relation(j, i, 'same_row')
            if same_column(a, b, graph_cfg):
                set_relation(i, j, 'same_column')
                set_relation(j, i, 'same_column')
            if box_iou(a, b) >= graph_cfg.overlap_iou_threshold:
                set_relation(i, j, 'overlap')
                set_relation(j, i, 'overlap')
            distance = math.hypot(a.cx - b.cx, a.cy - b.cy)
            if distance <= graph_cfg.proximity_distance_threshold and (any(flags.values()) or same_row(a, b, graph_cfg) or same_column(a, b, graph_cfg)):
                set_relation(i, j, 'controlled_proximity')
                set_relation(j, i, 'controlled_proximity')
    for u, v in reading_order_edges(boxes, graph_cfg):
        set_relation(u, v, 'reading_order')
    if not edge_relations:
        edge_index = np.zeros((2, 0), dtype=np.int64)
        edge_attr = np.zeros((0, schema.edge_feature_dim), dtype=np.float32)
    else:
        src = []
        dst = []
        attrs = []
        diagonal = math.sqrt(2.0)
        for (u, v), relation_vector_value in edge_relations.items():
            a = boxes[u]
            b = boxes[v]
            distance = math.hypot(a.cx - b.cx, a.cy - b.cy) / diagonal
            angle = math.atan2(b.cy - a.cy, b.cx - a.cx)
            continuous = np.array([distance, math.sin(angle), math.cos(angle)], dtype=np.float32)
            src.append(u)
            dst.append(v)
            attrs.append(np.concatenate([relation_vector_value, continuous]))
        edge_index = np.array([src, dst], dtype=np.int64)
        edge_attr = np.stack(attrs).astype(np.float32)
    data = Data(x=torch.from_numpy(node_features), edge_index=torch.from_numpy(edge_index), edge_attr=torch.from_numpy(edge_attr), num_nodes=n)
    data.is_empty = False
    return data

@dataclass
class GATConfig:
    hidden_dim: int = 128
    num_layers: int = 3
    heads: int = 4
    dropout: float = 0.1
    output_dim: int = 256
    pooling: str = 'mean'

class GATEncoder(nn.Module):

    def __init__(self, node_dim: int, edge_dim: int, cfg: GATConfig, device=None):
        super().__init__()
        self.device = device if device is not None else torch.device('cpu')
        self.cfg = cfg
        self.input_proj = nn.Linear(node_dim, cfg.hidden_dim)
        self.convs = nn.ModuleList()
        self.norms = nn.ModuleList()
        for i in range(cfg.num_layers):
            is_last = i == cfg.num_layers - 1
            concat = not is_last
            out_channels = cfg.hidden_dim if not concat else cfg.hidden_dim // cfg.heads
            self.convs.append(GATv2Conv(cfg.hidden_dim, out_channels, heads=cfg.heads, concat=concat, edge_dim=edge_dim, dropout=cfg.dropout, add_self_loops=True))
            self.norms.append(nn.LayerNorm(cfg.hidden_dim))
        self.output_proj = nn.Sequential(nn.Linear(cfg.hidden_dim, cfg.output_dim), nn.ReLU(), nn.Linear(cfg.output_dim, cfg.output_dim))
        self.empty_embedding = nn.Parameter(torch.zeros(cfg.output_dim))
        nn.init.normal_(self.empty_embedding, std=0.02)

    def encode_nonempty(self, x, edge_index, edge_attr, batch):
        h = self.input_proj(x)
        for conv, norm in zip(self.convs, self.norms):
            updated = conv(h, edge_index, edge_attr=edge_attr)
            updated = F.elu(updated)
            h = norm(updated + h if updated.shape == h.shape else updated)
        graph_feature = global_mean_pool(h, batch)
        return self.output_proj(graph_feature)

    @torch.inference_mode()
    def forward(self, data: Data):
        if data.num_nodes == 0:
            return self.empty_embedding.unsqueeze(0)
        batch = torch.zeros(data.num_nodes, dtype=torch.long, device=data.x.device)
        return self.encode_nonempty(data.x, data.edge_index, data.edge_attr, batch)
