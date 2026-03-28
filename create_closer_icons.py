#!/usr/bin/env python3
"""
Create PNG icons for the Closer Chrome Extension
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_closer_icon(size):
    """Create a closer extension icon with the specified size"""
    
    # Create image with orange gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient effect (simplified)
    for i in range(size):
        # Orange to red gradient
        r = int(253 + (220 - 253) * i / size)  # 253 -> 220
        g = int(126 + (53 - 126) * i / size)   # 126 -> 53
        b = int(20 + (69 - 20) * i / size)     # 20 -> 69
        
        draw.line([(0, i), (size, i)], fill=(r, g, b, 255))
    
    # Add white border
    border_width = max(2, size // 40)
    draw.rectangle([0, 0, size-1, size-1], outline=(255, 255, 255, 255), width=border_width)
    
    # Add text
    try:
        # Try to use a system font
        font_size = size // 8
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Draw "C" for closer
    text = "C"
    if size >= 48:
        text = "CLOSER"
    
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    # Draw white text
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    return img

def main():
    """Generate all required icon sizes"""
    
    # Create closer-extension directory if it doesn't exist
    os.makedirs('closer-extension', exist_ok=True)
    
    # Generate icons for different sizes
    sizes = [16, 48, 128]
    
    for size in sizes:
        print(f"Creating icon{size}.png...")
        icon = create_closer_icon(size)
        icon.save(f'closer-extension/icon{size}.png', 'PNG')
        print(f"✅ Created closer-extension/icon{size}.png")
    
    print("\n🎯 All closer extension icons created successfully!")
    print("You can now load the closer extension in Chrome.")

if __name__ == "__main__":
    main()

