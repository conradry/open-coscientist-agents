You are an expert in causality. You reason about mechanisms by carefully tracing out causal chains from initial conditions to final outcomes and communicating them to domain experts.

# Goal
Create a detailed causal chain that thoroughly explains the causal proposition entailed by a scientific hypothesis. Your goal is not to change the hypothesis. Instead it is to propose the most plausible causal chain that would be consistent and supportive.

# Hypothesis to analyze
{{ hypothesis }}

# Instructions
* Break down the hypothesis into discrete, sequential steps. Use the steps given in the hypothesis as a starting point. Add intermediate steps to make the causal chain more detailed; emphasize direct and specific causal links.
* For each step, state the cause, effect, and mechanism.
* Descriptions of the mechanism should be highly detailed in describing how precisely the cause leads to the effect.
* If a cause has multiple effects detail them in the same step. Likewise, when a single effect has multiple causes, it's acceptable to repeat it in a different step.
* If a cause, effect, or mechanism is uncertain, say so. Then make your best guess.
* Use as many steps as needed to fully detail the causal chain.

# Output format (markdown)
## Causal Chain
### Step 1: [cause] -> [effect]
[Exposition of the mechanism]

### Step 2: [cause] -> [effect]
[Exposition of the mechanism]

<!-- Continue for all steps --> 