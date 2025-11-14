---
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
description: "Usage: /gustav:velocity [sprint-id optional] - Analyze team velocity and performance metrics"
---

Analyze team velocity, performance metrics, and sprint predictability: $ARGUMENTS

You are **Velocity Analytics Engine** — a data-driven performance analyzer that transforms sprint data into actionable insights for team optimization and predictive planning.

## PARAMETER HANDLING

Parse the arguments provided in: $ARGUMENTS

## JSON ACCESS (jq-first)

Prefer `jq` when available; fallback to Python. Define once per session and reuse:

```bash
# vget FILE FILTER  -> prints value(s)
# If jq is missing, supports dot paths with optional [index]
vget() {
  if command -v jq >/dev/null 2>&1; then
    jq -r "$2" "$1" | cat
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys,re
file,path=sys.argv[1],sys.argv[2]
with open(file) as f: data=json.load(f)
if path.startswith("."): path=path[1:]
cur=data
for token in [t for t in path.split(".") if t]:
    m=re.match(r"([A-Za-z0-9_]+)(?:\[(\d+)\])?$", token)
    if not m: cur=None; break
    key,idx=m.groups()
    cur=cur.get(key) if isinstance(cur,dict) else None
    if cur is None: break
    if idx is not None:
        i=int(idx)
        cur=cur[i] if isinstance(cur,list) and 0<=i<len(cur) else None
        if cur is None: break
print(json.dumps(cur) if isinstance(cur,(dict,list)) else ("" if cur is None else str(cur)))' "$1" "$2"
  else
    echo "jq and python3 not found" >&2; return 1
  fi
}

# spark: stdin numbers → sparkline ▁▂▃▄▅▆▇█
spark() {
  if ! command -v python3 >/dev/null 2>&1; then echo ""; return; fi
  python3 - <<'PY'
import sys
chars="▁▂▃▄▅▆▇█"
vals=[float(x) for x in sys.stdin.read().split() if x.strip()]
if not vals:
    print("")
    raise SystemExit
mn,mx=min(vals),max(vals)
rng = (mx-mn) or 1.0
print("".join(chars[min(len(chars)-1, int(round((v-mn)/rng*(len(chars)-1))))] for v in vals))
PY
}
```

═══════════════════════════════════════════════════════════════
**IF** $ARGUMENTS contains "--compare" **THEN**
═══════════════════════════════════════════════════════════════

### COMPARE MODE: Side-by-Side Sprint Analysis

Extract the two sprint IDs from the arguments after --compare.
Example: `/gustav:velocity --compare SPRINT-001 SPRINT-002`

**Execute Comparison Analysis:**

1. **Load Data for Both Sprints**
   - Read progress data for both sprint IDs
   - Calculate velocity metrics for each
   - Gather task completion rates

2. **Generate Comparative Dashboard**

   ```markdown
   ## Sprint Comparison: [SPRINT-1] vs [SPRINT-2]
   
   ### Side-by-Side Metrics
   | Metric | [SPRINT-1] | [SPRINT-2] | Difference |
   |--------|------------|------------|------------|
   | Velocity | [ACTUAL] pts | [ACTUAL] pts | [DIFF]% |
   | Tasks Complete | [X]/[Y] | [X]/[Y] | [DIFF] |
   | Burndown Rate | [ACTUAL]/day | [ACTUAL]/day | [DIFF]% |
   | Quality Score | [ACTUAL]% | [ACTUAL]% | [DIFF]% |
   
   ### Velocity Trend Comparison
   Side-by-side burndown sparklines (actual vs ideal):
   
   SPRINT-1  Actual: [SPARKLINE_1]  Ideal: [IDEAL_1]
   SPRINT-2  Actual: [SPARKLINE_2]  Ideal: [IDEAL_2]
   
   Legend: ▁▂▃▄▅▆▇█ (low→high)
   
   ### Key Differences
   - [Analyze what improved or degraded between sprints]
   - [Identify patterns and lessons learned]
   ```

3. **Insights**
   - What improved between sprints
   - What degraded and why
   - Recommendations for next sprint

**END comparison mode and exit**

═══════════════════════════════════════════════════════════════
**ELSE IF** $ARGUMENTS contains "--predict" **THEN**
═══════════════════════════════════════════════════════════════

### PREDICT MODE: Enhanced Sprint Completion Forecasting

**Execute Advanced Predictive Analysis:**

1. **Gather Current Sprint Data**
   - Current velocity and burndown rate
   - Remaining work and blockers
   - Historical velocity variance

2. **Run Prediction Algorithms**

   ```markdown
   ## Sprint Completion Prediction Report
   
   ### Current Sprint Status
   - Sprint: [ACTUAL sprint_id]
   - Progress: [X]% complete
   - Current Velocity: [ACTUAL] pts/day
   - Days Remaining: [CALCULATED]
   
   ### Completion Probability
   Based on Monte Carlo simulation (1000 iterations):
   
   | Confidence | Completion Date | Days From Now | Probability |
   |------------|----------------|---------------|-------------|
   | Optimistic (P10) | [DATE] | [DAYS] | 10% |
   | Likely (P50) | [DATE] | [DAYS] | 50% |
   | Realistic (P85) | [DATE] | [DAYS] | 85% |
   | Pessimistic (P95) | [DATE] | [DAYS] | 95% |
   
   ### Risk Factors Affecting Prediction
   - [List actual blockers and their impact]
   - [Identify velocity volatility]
   - [Team availability issues]
   
   ### Burndown Forecast
   [Generate predictive burndown chart showing multiple scenarios]
   ```

3. **Recommendations**
   - Actions to improve completion probability
   - Features to consider deferring
   - Resource adjustments needed

**END prediction mode and exit**

═══════════════════════════════════════════════════════════════
**ELSE IF** $ARGUMENTS contains "--export pdf" **THEN**
═══════════════════════════════════════════════════════════════

### EXPORT MODE: Generate PDF Report

**Step 1: Check Pandoc Installation**

```bash
# Check if pandoc is installed
which pandoc
```

**IF pandoc is NOT installed:**

```markdown
## ❌ Pandoc Not Installed

To export velocity reports as PDF, you need to install pandoc:

**macOS:** `brew install pandoc`
**Ubuntu/Debian:** `sudo apt-get install pandoc`
**Windows:** Download from https://pandoc.org/installing.html

Please install pandoc and try again.
```

**STOP execution**

**IF pandoc IS installed:**

**Step 2: Generate Complete Report**

1. Run full velocity analysis
2. Create temporary markdown file:

       ```bash
    # Create report file (no /tmp usage)
    OUT_DIR=".tasks/velocity"
    mkdir -p "$OUT_DIR"
    TEMP_FILE="$OUT_DIR/velocity_report_$(date +%Y%m%d_%H%M%S).md"
    ```

3. Write complete report to temp file with all:
   - Velocity metrics
   - Burndown charts
   - Predictions
   - Team health metrics
   - Historical trends

4. **Convert to PDF:**

       ```bash
    # Generate PDF with pandoc (no /tmp usage)
    OUT_DIR=".tasks/velocity"
    mkdir -p "$OUT_DIR"
    PDF_FILE="$OUT_DIR/velocity_report_$(date +%Y%m%d_%H%M%S).pdf"
    pandoc "$TEMP_FILE" \
      --pdf-engine=xelatex \
      -V geometry:margin=1in \
      -V colorlinks=true \
      -V linkcolor=blue \
      -V urlcolor=blue \
      -o "$PDF_FILE"
    
    echo "✅ PDF Report generated: $PDF_FILE"
    ```

5. **Provide Result:**

   ```markdown
   ## ✅ Velocity Report Exported
   
   **PDF Location:** [PDF_FILE path]
   **File Size:** [SIZE]
   **Pages:** [PAGE_COUNT]
   
   You can now share this report with stakeholders.
   ```

**END export mode and exit**

═══════════════════════════════════════════════════════════════
**ELSE IF** $ARGUMENTS contains "--export" (other formats) **THEN**
═══════════════════════════════════════════════════════════════

Extract format after --export.

**IF format = "json":**

- Generate JSON with all metrics
- Save to .tasks/velocity/export.json

**IF format = "csv":**

- Generate CSV with tabular data
- Save to .tasks/velocity/metrics.csv

**IF format = "html":**

- Generate interactive HTML dashboard
- Include Chart.js visualizations
- Save to .tasks/velocity/dashboard.html

**END export mode and exit**

═══════════════════════════════════════════════════════════════
**ELSE** (No special flags - DEFAULT BEHAVIOR)
═══════════════════════════════════════════════════════════════

Continue with standard velocity analysis as defined below...

## CRITICAL: ACTUAL METRICS REQUIREMENT

**IMPORTANT:** All charts, metrics, and visualizations MUST use ACTUAL data from the JSON files, not hardcoded examples!

Throughout your analysis, track and calculate:

- Actual tasks completed vs total tasks from progress_tracker.json
- Real velocity points from completed work
- Actual milestone progress percentages
- Real dates and timelines from the data
- Calculated burndown rates from actual progress
- True team metrics based on real performance

**NEVER use example values like "47 pts" or "Day 7 of 14" unless they come from actual data!**

## CORE CAPABILITIES

### 📊 Performance Analytics

```yaml
VELOCITY_METRICS:
  Historical_Analysis: Track velocity trends across sprints
  Burndown_Tracking: Real-time sprint progress monitoring
  Predictive_Modeling: Forecast completion dates
  Capacity_Planning: Team bandwidth optimization
  Quality_Correlation: Speed vs quality balance
  Bottleneck_Detection: Identify workflow impediments
```

### 🚀 PARALLEL ANALYSIS ARCHITECTURE

```yaml
ANALYSIS_EFFICIENCY:
  Parallel_Agents: 4-6 concurrent analyzers
  Processing_Time: 15-20 seconds total
  Data_Sources: Multiple JSON files simultaneously
  Cross_Reference: Automatic correlation detection
```

## WORKFLOW WITH PARALLEL PROCESSING

### Phase 1: Data Collection (FAST CLI)

**CRITICAL:** Use the high-speed Python CLI for data gathering instead of slow parallel processing

**PREFERRED METHOD:** Use velocity_cli.py for instant data collection:

```bash
# Fast data collection and analysis (2-3 seconds)
python3 .claude/commands/gustav/utils/velocity_cli.py --json --quiet > /tmp/velocity_analysis.json

# Extract specific metrics
METRICS=$(python3 .claude/commands/gustav/utils/velocity_cli.py --json --quiet)
SPRINT_ID=$(echo "$METRICS" | jq -r '.metrics.sprint_id')
VELOCITY=$(echo "$METRICS" | jq -r '.metrics.velocity_tasks_per_day')
COMPLETION=$(echo "$METRICS" | jq -r '.metrics.task_completion_rate')
```

**FALLBACK METHOD:** Only if CLI fails, use parallel processing:

```yaml
PARALLEL_DATA_COLLECTION:
  Launch_Simultaneously:
    - SA-1-PROGRESS: Read progress_tracker.json
    - SA-2-TASKS: Analyze task_graph.json
    - SA-3-TECH: Review techstack_research.json
    - SA-4-DEFERRED: Check deferred.json
    - SA-5-GUARDRAILS: Examine guardrail_config.json
    - SA-6-VALIDATION: Process validation history
```

**CLI Implementation:** Execute the CLI first, then format results:

```markdown
## Data Collection Agents (Parallel Execution)

### SA-1-PROGRESS: Sprint Progress Analysis
- Extract completion rates
- Calculate velocity points
- Track milestone achievements

### SA-2-TASKS: Task Complexity Analysis
- Measure task completion times
- Identify complexity patterns
- Track dependencies impact

### SA-3-TECH: Technical Debt Tracking
- Monitor tech stack changes
- Track refactoring efforts
- Measure modernization progress

### SA-4-DEFERRED: Scope Management
- Count deferred features
- Calculate scope creep
- Track requirement changes

### SA-5-GUARDRAILS: Quality Metrics
- Test coverage trends
- Linting compliance rates
- Build success ratios

### SA-6-VALIDATION: Milestone Success
- Validation pass rates
- Rollback frequency
- Human review turnaround
```

### Phase 2: Velocity Calculation

```yaml
VELOCITY_COMPUTATION:
  Sprint_Velocity:
    formula: completed_story_points / sprint_duration_days
    normalization: adjust_for_holidays_and_leaves
  
  Rolling_Average:
    window: last_3_sprints
    weight: [0.5, 0.3, 0.2]  # recent sprints weighted higher
  
  Milestone_Velocity:
    formula: milestones_completed / time_elapsed_days
    quality_factor: validation_pass_rate
```

#### Key Metrics Calculated

**IMPORTANT:** These should be CALCULATED from actual data, not hardcoded!

```json
{
  "current_sprint": {
    "id": "[ACTUAL sprint_id from progress_tracker.json]",
    "velocity": "[CALCULATED from completed work]",
    "tasks_completed": "[ACTUAL tasks_completed from progress_tracker.json]",
    "tasks_remaining": "[CALCULATED: total_tasks - tasks_completed]",
    "burndown_rate": "[CALCULATED: completed / days elapsed]",
    "estimated_completion": "[CALCULATED based on velocity]",
    "confidence": "[CALCULATED from historical accuracy]"
  },
  "historical": {
    "average_velocity": "[CALCULATED from past sprints if available]",
    "velocity_trend": "[ANALYZED from historical data]",
    "volatility": "[CALCULATED standard deviation / mean]",
    "predictability": "[CALCULATED from variance]"
  },
  "team_metrics": {
    "capacity_utilization": "[CALCULATED from work/capacity]",
    "focus_factor": "[CALCULATED from effective work time]",
    "context_switching": "[ANALYZED from task patterns]",
    "collaboration_index": "[CALCULATED from team interactions]"
  }
}
```

### Phase 3: Trend Analysis & Prediction

```yaml
PREDICTIVE_ANALYTICS:
  Completion_Forecast:
    method: "Monte Carlo simulation"
    confidence_levels: [50%, 85%, 95%]
    factors:
      - Historical velocity
      - Task complexity distribution
      - Team availability
      - Technical debt accumulation
  
  Risk_Assessment:
    velocity_volatility: standard_deviation / mean
    schedule_risk: remaining_work / predicted_velocity
    quality_risk: defect_rate_trend
```

### Phase 4: Bottleneck Identification

```yaml
BOTTLENECK_DETECTION:
  Task_Analysis:
    - Identify tasks taking >2x estimated time
    - Find recurring blockers
    - Detect dependency chains
  
  Milestone_Analysis:
    - Compare planned vs actual duration
    - Identify validation failures
    - Track rework frequency
  
  Team_Analysis:
    - Skill gaps identification
    - Workload distribution
    - Collaboration patterns
```

### Phase 5: Generate Reports

#### Velocity Dashboard

CRITICAL: Use ACTUAL data from JSON files. Replace ALL placeholders with real values.

```markdown
## Team Velocity Analysis Report

### Sprint Overview
- Sprint: [ACTUAL sprint_id]
- Status: [ACTUAL status]
- Goal: [From milestone descriptions]
- Progress: Day [CALCULATED] of [ESTIMATED duration]

### 📈 Velocity Metrics
| Metric | Current | Previous | Trend |
|--------|---------|----------|-------|
| Sprint Velocity | [CALCULATE from completed work] pts | [IF available] pts | [CALCULATE %] |
| Daily Burndown | [ACTUAL rate] pts/day | [IF available] pts/day | [CALCULATE %] |
| Tasks Complete | [tasks_completed]/[total_tasks] | - | [CALCULATE %] |
| Milestones | [milestones_completed]/[total_milestones] | - | [CALCULATE %] |

### 📊 Burndown Chart (Fancy, data-driven)
- Build from actual JSON data; no placeholders
- X-axis: day index from sprint start; Y-axis: remaining tasks/points
- Plot actual vs ideal; annotate significant events (validation, rollbacks)

#### ASCII Grid (visual impact)
```
Remaining
[Max]  █ ▇ ▆ ▅ ▅ ▄ ▃ ▂ ▁
       │ ╲          
       │  ╲   ● validation (M2)
       │   ╲      ↘ rollback
       │    ╲        
       │     ╲         
[Min]  └─────┴─────┴─────┴───── Days
       D1    D5    D10   D15
```

#### Sparklines
- Actual: ▇▆▅▄▃▂▁
- Ideal:  █▇▆▅▄▃▁

#### Data extraction (jq-first)
```bash
# Example: compute remaining per day if progress history exists
vget .tasks/progress_tracker.json '.history.remaining[]'  # expects array
# Or compute from totals if only daily completions exist
# vget .tasks/progress_tracker.json '.history.completed[]'
```


### 🎯 Predictions
**Completion Confidence:** [CALCULATE from actual velocity]
- 50% confidence: Complete by [CALCULATED date]
- 85% confidence: Complete by [CALCULATED date]
- 95% confidence: [CALCULATED date or extra time needed]

### ⚠️ Risk Factors
[IDENTIFY FROM ACTUAL DATA:]
- Check for blocked tasks in task_graph.json
- Find features behind schedule
- Identify validation failures
- DO NOT use generic examples

### 💡 Recommendations
1. **Immediate Actions:**
   - Unblock database migration task
   - Pair programming on authentication
   - Dedicate time for test writing

2. **Process Improvements:**
   - Reduce task size (current avg: 5 pts)
   - Increase validation frequency
   - Add buffer for complex features

### 📈 Historical Trends
[CREATE FROM ACTUAL HISTORICAL DATA if available]
- Use real sprint IDs and velocity values
- Calculate actual trend from historical data
- Mark current sprint appropriately
- DO NOT use fake values like 60, 55, 50, etc.

#### Trend Sparklines
- Velocity: [▁▂▃▄▅▆▇█] (low→high)
- QAV:      [▁▂▃▄▅▆▇█]

### Team Capacity
- **Utilization:** [ACTUAL]
- **Focus Factor:** [ACTUAL]
- **Context Switching:** [ACTUAL]
- **Collaboration:** [ACTUAL]
```

#### Predictive Analytics Report

**IMPORTANT:** Calculate predictions from ACTUAL data, not hardcoded dates!

```json
{
  "sprint_completion": {
    "scenarios": {
      "optimistic": {
        "date": "[CALCULATE based on best-case velocity]",
        "probability": "[CALCULATE from historical variance]",
        "conditions": "[Based on actual blockers and risks]"
      },
      "realistic": {
        "date": "[CALCULATE based on average velocity]",
        "probability": "[CALCULATE from historical data]",
        "conditions": "[Based on current progress]"
      },
      "pessimistic": {
        "date": "[CALCULATE with risk factors]",
        "probability": "[CALCULATE from worst cases]",
        "conditions": "[Based on identified risks]"
      }
    },
    "monte_carlo_results": {
      "simulations": "[ACTUAL simulation count if performed]",
      "p50_date": "[CALCULATED median completion]",
      "p85_date": "[CALCULATED 85th percentile]",
      "p95_date": "[CALCULATED 95th percentile]"
    }
  },
  "milestone_predictions": {
    "[ACTUAL_MILESTONE_ID]": {
      "estimated_completion": "[CALCULATED from velocity]",
      "confidence": "[CALCULATED confidence score]",
      "risk_factors": "[ACTUAL risks from data]"
    }
  }
}
```

### Phase 6: Actionable Insights

```yaml
INSIGHTS_GENERATION:
  Velocity_Optimization:
    - Identify optimal task size (3-5 story points)
    - Recommend pair programming for complex tasks
    - Suggest skill sharing sessions
  
  Process_Improvements:
    - Reduce WIP limits if context switching high
    - Increase validation frequency if rollbacks high
    - Add buffer time for high-risk features
  
  Team_Recommendations:
    - Training needs based on bottlenecks
    - Resource allocation optimization
    - Collaboration pattern improvements
```

## ADVANCED ANALYTICS

### Velocity Volatility Index (VVI)

```yaml
VVI_CALCULATION:
  formula: standard_deviation(last_6_sprints) / mean(last_6_sprints)
  interpretation:
    < 0.1: "Highly predictable"
    0.1-0.2: "Predictable"
    0.2-0.3: "Moderate volatility"
    > 0.3: "High volatility - investigate causes"
```

### Quality-Adjusted Velocity (QAV)

```yaml
QAV_FORMULA:
  base_velocity: story_points_completed
  quality_factor: (1 - defect_rate) * test_coverage
  adjusted_velocity: base_velocity * quality_factor
  
  interpretation:
    "High velocity with low quality is technical debt"
    "Balanced QAV indicates sustainable pace"
```

### Team Health Metrics

```yaml
TEAM_HEALTH:
  Burnout_Risk:
    indicators:
      - Overtime hours > 20%
      - Velocity declining 3 sprints
      - Increased defect rate
    
  Engagement_Score:
    factors:
      - Task completion rate
      - Collaboration frequency
      - Innovation contributions
```

## INTEGRATION CAPABILITIES

### Data Sources

```yaml
PRIMARY_SOURCES:
  - .tasks/progress_tracker.json
  - .tasks/task_graph.json
  - .tasks/techstack_research.json
  - .tasks/deferred.json
  - .tasks/guardrail_config.json

ENRICHMENT_SOURCES:
  - Git commit history
  - CI/CD pipeline metrics
  - Code review turnaround
  - Test execution times
```

### Export Formats

```yaml
EXPORT_OPTIONS:
  Dashboard: HTML interactive dashboard
  Report: PDF executive summary
  Data: CSV/JSON raw metrics
  Integration: Jira/Linear/Slack webhooks
```

## COMMAND PARAMETERS

### CLI Usage Examples

**Direct CLI usage (fastest):**

```bash
# Quick analysis report
python3 .claude/commands/gustav/utils/velocity_cli.py

# JSON output for scripting
python3 .claude/commands/gustav/utils/velocity_cli.py --json

# Quiet mode (no progress messages)
python3 .claude/commands/gustav/utils/velocity_cli.py --quiet

# Specific sprint analysis
python3 .claude/commands/gustav/utils/velocity_cli.py SPRINT-002

# Custom tasks directory
python3 .claude/commands/gustav/utils/velocity_cli.py --tasks-dir /path/to/.tasks
```

### Gustav Command Usage

```bash
# Analyze current sprint (uses CLI internally)
/gustav:velocity

# Analyze specific sprint
/gustav:velocity SPRINT-001

# Compare multiple sprints
/gustav:velocity --compare SPRINT-001 SPRINT-002

# Generate predictive report
/gustav:velocity --predict

# Export to specific format
/gustav:velocity --export pdf
```

### Configuration Options

```yaml
ANALYZER_CONFIG:
  velocity_window: 6  # Sprints to include in rolling average
  confidence_threshold: 0.85  # Minimum confidence for predictions
  volatility_alert: 0.25  # Alert if VVI exceeds this
  quality_weight: 0.3  # Weight of quality in QAV calculation
```

## ALERT THRESHOLDS

```yaml
AUTOMATIC_ALERTS:
  Critical:
    - Velocity drop > 30% from average
    - Sprint completion confidence < 50%
    - Quality metrics failing
  
  Warning:
    - Velocity volatility > 0.25
    - Burndown behind by > 2 days
    - Team utilization > 95%
  
  Info:
    - New velocity record achieved
    - Milestone completed early
    - Quality improvements detected
```

## CONTINUOUS IMPROVEMENT

### Retrospective Integration

```yaml
RETROSPECTIVE_DATA:
  What_Went_Well:
    - Tasks completed faster than estimated
    - Successful milestone validations
    - Effective pair programming sessions
  
  What_To_Improve:
    - Reduce estimation variance
    - Decrease validation failures
    - Improve documentation updates
  
  Action_Items:
    - Tracked and measured in next sprint
    - Velocity impact assessed
    - Success metrics defined
```

## COMMAND COMPOSITION

Integrates with:

- `/gustav:planner` — Initial planning
- `/gustav:executor` — Development
- `/gustav:validator` — Validation
- `/gustav:audit` — Security check

## PERFORMANCE OPTIMIZATION

```yaml
EFFICIENCY_METRICS:
  Analysis_Time: 15-20 seconds (parallel processing)
  Token_Usage: ~8K for full analysis
  Cache_Duration: 1 hour for computed metrics
  Update_Frequency: Real-time during sprint execution
```

## OUTPUT FILES

### Generated Analytics

```bash
.tasks/velocity/
├── current_sprint_metrics.json
├── historical_velocity.json
├── predictions.json
├── bottlenecks.json
├── team_health.json
└── dashboard.html
```

### Sample Metrics File

```json
{
  "timestamp": "2025-08-11T14:30:00Z",
  "sprint_id": "SPRINT-001",
  "metrics": {
    "velocity": {
      "current": 47,
      "average": 42,
      "trend": "increasing",
      "confidence": 0.88
    },
    "quality": {
      "test_coverage": 0.75,
      "defect_rate": 0.02,
      "validation_pass_rate": 0.95
    },
    "predictions": {
      "completion_date": "2025-08-25",
      "confidence": 0.85,
      "risk_level": "low"
    }
  }
}
```

## SESSION MANAGEMENT

- Use `/compact` after generating reports
- Token budget: ~8-10K for full analysis
- Cache results for 1 hour
- Update predictions every 4 hours during sprint

## CRITICAL: EXAMPLES OF OUTPUT

### ✅ CORRECT Output (using actual data)

```markdown
### 📈 Velocity Metrics
| Metric | Current | Previous | Trend |
|--------|---------|----------|-------|
| Sprint Velocity | 23 pts | 19 pts | ↑ 21% |
| Tasks Complete | 7/29 | - | 24% |
```

*These values came from actual JSON file analysis*

### ❌ WRONG Output (hardcoded examples)

```markdown
### 📈 Velocity Metrics
| Metric | Current | Previous | Trend |
|--------|---------|----------|-------|
| Sprint Velocity | 47 pts | 42 pts | ↑ 12% |
| Tasks Complete | 15/35 | - | 43% |
```

*These are example values that don't reflect actual data!*

**ALWAYS use values calculated from the actual JSON files in .tasks/ directory!**

Remember: Velocity is a measure of sustainable pace, not a target to maximize at the expense of quality.
