from PIL import Image, ImageOps
import sys

input_path = r"C:\Users\maogo\Downloads\fiverr_discord_bot_thumbnail_v2_1772920457498.png"
output_path = r"C:\Users\maogo\Downloads\fiverr_discord_bot_thumbnail_1280x769.png"

try:
    with Image.open(input_path) as img:
        img_fit = ImageOps.fit(img, (1280, 769), method=Image.Resampling.LANCZOS)
        img_fit.save(output_path)
        print("SUCCESS: Image successfully resized and cropped to", output_path)
except Exception as e:
    print("ERROR:", e)
    sys.exit(1)
