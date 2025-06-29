import os
import shutil
from PIL import Image

# --- 配置 ---
# 这里是你的壁纸文件夹路径，'.' 代表当前文件夹，也就是脚本所在的文件夹。
# 你通常不需要修改这里。
SOURCE_FOLDER = '.' 
# 这是将要创建的用于存放分类后壁纸的文件夹名称。
DESKTOP_FOLDER = '电脑壁纸'
MOBILE_FOLDER = '手机壁纸'
SQUARE_FOLDER = '正方形壁纸'

def sort_wallpapers():
    """主函数，用于执行分类任务"""
    print("开始整理壁纸...")

    # 1. 创建目标文件夹（如果不存在的话）
    desktop_path = os.path.join(SOURCE_FOLDER, DESKTOP_FOLDER)
    mobile_path = os.path.join(SOURCE_FOLDER, MOBILE_FOLDER)
    square_path = os.path.join(SOURCE_FOLDER, SQUARE_FOLDER)

    if not os.path.exists(desktop_path):
        os.makedirs(desktop_path)
    if not os.path.exists(mobile_path):
        os.makedirs(mobile_path)
    if not os.path.exists(square_path):
        os.makedirs(square_path)

    # 2. 遍历源文件夹中的所有文件
    for filename in os.listdir(SOURCE_FOLDER):
        # 确保只处理图片文件，避免处理脚本自身或文件夹
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
            continue

        file_path = os.path.join(SOURCE_FOLDER, filename)

        try:
            # 3. 打开图片并获取尺寸
            with Image.open(file_path) as img:
                width, height = img.size

            # 4. 根据宽高比判断类型并移动文件
            if width > height:
                print(f"识别到电脑壁纸: {filename} ({width}x{height})")
                shutil.move(file_path, os.path.join(desktop_path, filename))
            elif height > width:
                print(f"识别到手机壁纸: {filename} ({width}x{height})")
                shutil.move(file_path, os.path.join(mobile_path, filename))
            else:
                print(f"识别到正方形图片: {filename} ({width}x{height})")
                shutil.move(file_path, os.path.join(square_path, filename))

        except Exception as e:
            print(f"处理文件 {filename} 时出错: {e}")

    print("\n整理完成！所有图片均已分类到对应的文件夹中。")

# --- 运行脚本 ---
if __name__ == "__main__":
    sort_wallpapers()
    input("\n按任意键退出...") # 防止窗口运行后立即关闭