import os
import asyncio
from dotenv import load_dotenv

os.chdir('/home/open-coscientist-agents')

load_dotenv()

from coscientist.framework import CoscientistConfig, CoscientistFramework
from coscientist.global_state import CoscientistState, CoscientistStateManager

# GOAL = (
#     "Develop high-performance and air-stable n-type organic thermoelectric materials "
#     "by optimizing the molecular structure or molecular packing of "
#     "poly(benzodifurandione) (PBFDO) to enhance the power factor (S²σ) "
#     "while maintaining low thermal conductivity."
# )

GOAL = (
    "Develop high-performance and air-stable n-type organic thermoelectric materials "
    "by optimizing the molecular structure or molecular packing of "
    "poly(benzodifurandione) (PBFDO) to enhance the power factor "
    "while maintaining low thermal conductivity."
)

async def main():
    # 测试用，每次清空
    CoscientistState.clear_goal_directory(GOAL)
    initial_state = CoscientistState(goal=GOAL)
    
    # # 生产环境
    # try:
    #     initial_state = CoscientistState(goal=GOAL)
    # except FileExistsError:
    #     initial_state = CoscientistState.load_latest(goal=GOAL)  # 断点续跑

    config = CoscientistConfig(
        specialist_fields=["organic chemistry", "materials science", "thermoelectrics", "polymer physics"],
    )
    state_manager = CoscientistStateManager(initial_state)
    cosci = CoscientistFramework(config, state_manager)

    final_report, final_meta_review = await cosci.run()

    output_path = f"{initial_state._output_dir}/output.txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(f"GOAL\n{GOAL}\n\nFINAL META-REVIEW\n{final_meta_review}\n\nFINAL REPORT\n{final_report}\n")
    print(f"Output saved to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
