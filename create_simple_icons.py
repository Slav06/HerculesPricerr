#!/usr/bin/env python3
"""
Simple icon generator for Chrome extensions
Creates basic colored squares with text
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("PIL not available, creating simple text files instead")

import os

def create_simple_icon(size, text, color, filename):
    """Create a simple colored square icon"""
    if PIL_AVAILABLE:
        # Create image with PIL
        img = Image.new('RGB', (size, size), color)
        draw = ImageDraw.Draw(img)
        
        # Try to use a font, fallback to default
        try:
            font_size = max(8, size // 8)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        # Draw text in center
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        
        draw.text((x, y), text, fill='white', font=font)
        
        # Save image
        img.save(filename)
        print(f"Created {filename}")
    else:
        # Create a simple text file as placeholder
        with open(filename.replace('.png', '.txt'), 'w') as f:
            f.write(f"Icon: {text}\nSize: {size}x{size}\nColor: {color}\n")
        print(f"Created {filename.replace('.png', '.txt')} (PIL not available)")

def main():
    # Create fronter extension icons
    fronter_color = '#007bff'  # Blue
    closer_color = '#fd7e14'   # Orange
    
    # Fronter icons
    create_simple_icon(16, 'F', fronter_color, 'fronter-extension/icon16.png')
    create_simple_icon(48, 'F', fronter_color, 'fronter-extension/icon48.png')
    create_simple_icon(128, 'FRONTER', fronter_color, 'fronter-extension/icon128.png')
    
    # Closer icons
    create_simple_icon(16, 'C', closer_color, 'closer-extension/icon16.png')
    create_simple_icon(48, 'C', closer_color, 'closer-extension/icon48.png')
    create_simple_icon(128, 'CLOSER', closer_color, 'closer-extension/icon128.png')
    
    print("\n✅ Icons created successfully!")
    print("📁 Fronter icons: Blue with 'F' or 'FRONTER'")
    print("📁 Closer icons: Orange with 'C' or 'CLOSER'")

if __name__ == "__main__":
    main()
