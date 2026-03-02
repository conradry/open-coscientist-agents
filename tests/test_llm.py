from gettext import find
import litellm
import os
from dotenv import load_dotenv, find_dotenv

os.chdir('/home/open-coscientist-agents')

load_dotenv()
print(os.getenv("AISCI_API_KEY"))
file = find_dotenv()
print(file)

# ==================== 测试 1: 聊天完成 (Chat Completion) ====================
print("=" * 60)
print("测试 1: 聊天完成 (Chat Completion)")
print("=" * 60)

# 调用 LiteLLM 的 completion 函数
response = litellm.completion(
    model="aisci/gpt-4.1-mini",  
    messages=[{"role": "user", "content": "Hello"}],  
)

# # 使用 openai/ 前缀强制走 OpenAI 逻辑
# response = litellm.completion(
#     model="openai/gpt-4.1-mini", 
#     messages=[{"role": "user", "content": "你好"}],  
#     api_base=os.getenv("AISCI_BASE_URL"),
#     api_key=os.getenv("AISCI_API_KEY")
# )

# 打印响应内容
print("聊天响应:")
print(response)
print()

# 提取具体的回复内容
if hasattr(response, 'choices') and len(response.choices) > 0:
    message_content = response.choices[0].message.content
    print(f"模型回复: {message_content}")



# ==================== 测试 2: 嵌入向量 (Embedding) ====================
print("=" * 60)
print("测试 2: 嵌入向量 (Embedding)")
print("=" * 60)

response = litellm.embedding(
    model="qianfan/qwen3-embedding-4b",
    input="Hello, this is a test for embedding.",
)

# 打印嵌入响应
print("嵌入响应:")
# print(response)

# 提取嵌入向量
if hasattr(response, 'data') and len(response.data) > 0:
    embedding_vector = response.data[0]['embedding']
    print(f"嵌入向量维度: {len(embedding_vector)}")
    print(f"向量前10个值: {embedding_vector[:10]}")
    