"""Protect the site/duplicate boundary used for held-out evaluation."""
import csv
from pathlib import Path
import tempfile
import unittest

import tldextract

from dpd.data.audit import grouped_splits, match_saved_manifest, overlap, site_from_filename


class DatasetAuditTests(unittest.TestCase):
    def test_saved_manifest_matches_relocated_files_and_rejects_bad_membership(self):
        local = [{"file_name": "a.png", "label": 1}, {"file_name": "b.png", "label": 0}]
        valid = [{"sample_id": "old-a", "image_path": "/content/images/a.png", "label": "1", "split": "train"},
                 {"sample_id": "old-b", "image_path": "/content/images/b.png", "label": "0", "split": "test"}]
        cases = [valid[:1], valid + valid[:1],
                 [dict(valid[0], label="0"), valid[1]],
                 [dict(valid[0], split="unknown"), valid[1]],
                 [valid[0], dict(valid[1], sample_id="old-a")]]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "saved.csv"

            def write(rows):
                with path.open("w", newline="") as handle:
                    writer = csv.DictWriter(handle, fieldnames=list(valid[0]))
                    writer.writeheader()
                    writer.writerows(rows)

            write(valid)
            matched = match_saved_manifest(path, local)
            self.assertEqual([row["split"] for row in matched], ["train", "test"])
            self.assertEqual(matched[0]["historical_sample_id"], "old-a")
            for rows in cases:
                with self.subTest(rows=rows):
                    write(rows)
                    with self.assertRaises(ValueError):
                        match_saved_manifest(path, local)

    def test_domains_ignore_capture_suffixes_and_subdomains(self):
        extractor = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)
        for name, expected in (
            ("shapermint.com.png", "site:shapermint.com"),
            ("(275)www.shapermint.com_b425.jpg", "site:shapermint.com"),
            ("www.wowcher.co.uk.png", "site:wowcher.co.uk"),
            ("secure.mdg.com.png", "site:mdg.com"),
            ("1944.jpg", None),
            ("HIGH_DEMAND_MESSAGE_1.png", None),
        ):
            with self.subTest(name=name):
                self.assertEqual(site_from_filename(name, extractor), expected)

    def test_groups_and_identical_pixels_stay_together(self):
        rows = []
        for group in range(20):
            for label in (0, 1):
                identity = f"{group}-{label}"
                rows.append({"sample_id": identity, "group_id": f"site:{group}.example",
                             "label": label, "file_sha256": identity,
                             "pixel_sha256": identity})
        # Different sites with a decoded-identical image must share a split.
        rows[2]["pixel_sha256"] = rows[0]["pixel_sha256"]
        split = grouped_splits(rows, 42, [0.7, 0.15, 0.15])
        self.assertEqual(split, grouped_splits(rows, 42, [0.7, 0.15, 0.15]))
        self.assertEqual(len(split), len(rows))
        self.assertEqual({r["split"] for r in split}, {"train", "val", "test"})
        for key in ("sample_id", "group_id", "file_sha256", "pixel_sha256"):
            self.assertEqual(overlap(split, key), {})
        self.assertEqual(split[0]["split"], split[2]["split"])


if __name__ == "__main__":
    unittest.main()
