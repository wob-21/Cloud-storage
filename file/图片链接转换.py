# 你的图片链接
links = """
https://img-lca79pouk-lalalas-projects-1c18f7eb.vercel.app/file/1751534894619_156.png
https://img-lca79pouk-lalalas-projects-1c18f7eb.vercel.app/file/1751534894854_mobai.png
"""

# 将链接按换行符分割
links = links.strip().split()

# 转换成 Markdown 格式
markdown_links = [f"![图片{i+1}]({link})" for i, link in enumerate(links)]

# 定义输出文件路径
output_file_path = "图片链接转换.txt"

# 写入文件
with open(output_file_path, "w", encoding="utf-8") as file:
    for md in markdown_links:
        file.write(md + "\n")

print(f"文件已成功保存为: {output_file_path}")
