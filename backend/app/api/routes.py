from fastapi import APIRouter, UploadFile, File, HTTPException
import tempfile
import os
from app.api.visualizer import VisualizerCLI
import base64
from app.services.analysis_service import AnalysisService


router = APIRouter(
    prefix="/api/v1",
    tags=["analysis"]
)

@router.post("/analyze")
async def analyze(
    image: UploadFile = File(...)
):
    temp_path = None

    try:
        # Validate
        if not image.content_type:
            raise HTTPException(
                status_code=400,
                detail="Invalid image."
            )

        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="Uploaded file must be an image."
            )

        # Save input image
        suffix = os.path.splitext(
            image.filename or ".png"
        )[1]

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp_file:

            temp_path = temp_file.name

            contents = await image.read()
            temp_file.write(contents)

        print(f"[API] Image received: {image.filename}")
        print(f"[API] Temporary file: {temp_path}")

        # Call HF detector
        analysis_service = AnalysisService()
        result = analysis_service.analyze_image(temp_path)

        # =====================================================
        # ONLY VISUALIZE DARK PATTERNS
        # =====================================================

        
        if result.get("prediction") == 1:

            visualizer = VisualizerCLI()

            visualization_path = visualizer.visualise(
                result=result,
                image_path=temp_path,
                output_dir = tempfile.gettempdir()
            )

            with open(visualization_path, "rb") as f:
                image_bytes = f.read()

            image_base64 = base64.b64encode(image_bytes).decode("utf-8")

            result["visualization"] = {
                "generated": True,
                "image": image_base64,
                "content_type": "image/png"
            }




        else:

            print("[API] No dark pattern detected")

            result["visualization"] = {
                "generated": False,
                "path": None
            }

        return result

    except HTTPException:
        raise

    except Exception as e:

        print(f"[API] Analysis failed: {e}")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:

        if temp_path and os.path.exists(temp_path):

            try:
                os.remove(temp_path)

            except Exception as e:

                print(
                    f"[API] Failed to remove temp file: {e}"
                )