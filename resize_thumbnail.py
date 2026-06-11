from PIL import Image, ImageOps
import sys
import os

input_path = "./public/original_thumbnail.png"
output_path = "./docs/realnews-home.png"

if not os.path.exists(input_path):
    print(f"INFO: Place your raw screenshot at {input_path} to resize it.")
    sys.exit(0)

try:
    with Image.open(input_path) as img:
        img_fit = ImageOps.fit(img, (1280, 769), method=Image.Resampling.LANCZOS)
        img_fit.save(output_path)
        print("SUCCESS: Image successfully resized and cropped to", output_path)
except Exception as e:
    print("ERROR:", e)
    sys.exit(1)
