"""
测试 aisci 代理上各模型是否可用。
每个模型发一条极短消息，记录成功/失败和响应时间。
"""

import os
import time
from dotenv import load_dotenv
import litellm

os.chdir('/home/open-coscientist-agents')
load_dotenv()

litellm.suppress_debug_info = True

MODELS = [
    # OpenAI
    "gpt-5",
    "gpt-5.2",
    "gpt-5-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    # Gemini
    "gemini-3-pro-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash-image-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-image",
    # Claude
    "claude-sonnet-4-5-20250929",
    # # DeepSeek
    # "deepseek-v3-250324",
    # "deepseek-r1-250120",
    # "deepseek-r1-250528",
]

MESSAGES = [{"role": "user", "content": "hi"}]

results = []

print(f"\n{'模型':<40} {'状态':<8} {'耗时':>6}  {'备注'}")
print("-" * 80)

for model_name in MODELS:
    full_model = f"aisci/{model_name}"
    t0 = time.time()
    try:
        resp = litellm.completion(
            model=full_model,
            messages=MESSAGES,
            max_tokens=10,
            timeout=30,
        )
        elapsed = time.time() - t0
        reply = resp.choices[0].message.content.strip().replace("\n", " ")[:30]
        print(f"{full_model:<40} {'✅ OK':<8} {elapsed:>5.1f}s  \"{reply}\"")
        results.append((model_name, True, elapsed, ""))
    except Exception as e:
        elapsed = time.time() - t0
        err = str(e)[:80].replace("\n", " ")
        print(f"{full_model:<40} {'❌ FAIL':<8} {elapsed:>5.1f}s  {err}")
        results.append((model_name, False, elapsed, err))

print("\n" + "=" * 80)
ok  = [r for r in results if r[1]]
fail = [r for r in results if not r[1]]
print(f"✅ 可用: {len(ok)}/{len(results)}   ❌ 不可用: {len(fail)}/{len(results)}")
if ok:
    print("\n可用模型:")
    for r in ok:
        print(f"  aisci/{r[0]}")
if fail:
    print("\n不可用模型:")
    for r in fail:
        print(f"  aisci/{r[0]}")
