import os
from PIL import Image

def main():
    img_dir = os.path.dirname(os.path.abspath(__file__))
    img_files = ['1.jpg', '2.jpg', '3.jpg', '4.jpg']
    img_paths = [os.path.join(img_dir, f) for f in img_files]

    # Verify all files exist
    for p in img_paths:
        if not os.path.exists(p):
            print(f"Error: {p} does not exist.")
            return

    # Open images and convert to RGB
    images = [Image.open(p).convert('RGB') for p in img_paths]

    # Calculate target dimensions (limit max width to 400px for ultra-light weight)
    orig_w, orig_h = images[0].size
    max_w = 400
    if orig_w > max_w:
        target_w = max_w
        target_h = int(orig_h * (max_w / orig_w))
    else:
        target_w, target_h = orig_w, orig_h
    target_size = (target_w, target_h)
    print(f"Resizing images to ({target_w}x{target_h}) for sub-500KB GIF.")

    # Resize all images to target size with Lanczos resampling
    resized_images = [img.resize(target_size, Image.Resampling.LANCZOS) for img in images]

    frames = []
    hold_frames = 10 # 1.0 seconds at 100ms/frame
    fade_frames = 3  # 0.3 seconds at 100ms/frame

    num_imgs = len(resized_images)
    for i in range(num_imgs):
        img_current = resized_images[i]
        img_next = resized_images[(i + 1) % num_imgs]
        
        # Hold current image
        for _ in range(hold_frames):
            frames.append(img_current)
            
        # Fade to next image
        for f in range(1, fade_frames + 1):
            alpha = f / (fade_frames + 1)
            blended = Image.blend(img_current, img_next, alpha)
            frames.append(blended)

    # Quantize to 16 colors to strictly guarantee file size < 500KB
    print("Quantizing frames to 16 colors...")
    quantized_frames = []
    for frame in frames:
        quantized_frames.append(frame.convert('P', palette=Image.Palette.ADAPTIVE, colors=16))

    # Save as animated GIF
    output_path = os.path.join(img_dir, 'animacion.gif')
    quantized_frames[0].save(
        output_path,
        save_all=True,
        append_images=quantized_frames[1:],
        duration=100, # milliseconds per frame
        loop=0,
        optimize=True
    )
    print(f"Successfully saved optimized sub-500KB GIF to: {output_path}")

if __name__ == '__main__':
    main()
