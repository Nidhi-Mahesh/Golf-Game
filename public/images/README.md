# Background Images

## Level Select Background Image
Background image for the Level Select screen: `levels.png`

### Recommended Image Specifications:
- **Format**: JPG or PNG
- **Resolution**: 1920x1080 or higher
- **Aspect Ratio**: 16:9 (landscape)
- **File Size**: Under 2MB for fast loading
- **Style**: Golf course, nature, or sports-themed background

### Suggested Image Types:
- Aerial view of a golf course
- Beautiful green landscape with trees
- Golf course fairway with trees and sky
- Nature background with grass and trees
- Scenic golf course with mountains/hills in background

### Current Usage:
The image is used as the background for the Level Select screen with:
- 60% brightness filter for text readability
- Cover background-size to fill the entire screen
- Centered positioning
- Fallback gradient if image doesn't load

### Current Image:
- `levels.png` - Currently used as the Level Select background

### To Change Your Image:
1. Replace `levels.png` with your preferred image (keep the same filename)
2. Or update the filename reference in LevelSelectScreen.tsx
3. If no image is present, a green gradient background will show instead
