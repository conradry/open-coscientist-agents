#!/usr/bin/env python3
"""
Gustav Velocity CLI - Fast data gathering for velocity analysis
Speeds up data collection from JSON files for velocity reporting
"""

import json
import argparse
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import statistics
import re


class VelocityAnalyzer:
    def __init__(self, tasks_dir: Path = None):
        self.tasks_dir = tasks_dir or Path(".tasks")
        self.data = {}
        self.metrics = {}
    
    def load_json_file(self, filename: str) -> Dict[str, Any]:
        """Load a JSON file safely"""
        file_path = self.tasks_dir / filename
        try:
            if file_path.exists():
                with open(file_path, 'r') as f:
                    return json.load(f)
            return {}
        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load {filename}: {e}", file=sys.stderr)
            return {}
    
    def load_all_data(self):
        """Load all relevant JSON files in parallel concept"""
        files_to_load = [
            'progress_tracker.json',
            'task_graph.json', 
            'techstack_research.json',
            'deferred.json',
            'guardrail_config.json',
            'prd_digest.json'
        ]
        
        for filename in files_to_load:
            key = filename.replace('.json', '')
            self.data[key] = self.load_json_file(filename)
        
        print(f"✅ Loaded {len(self.data)} data files")
    
    def calculate_sprint_metrics(self) -> Dict[str, Any]:
        """Calculate current sprint metrics"""
        progress = self.data.get('progress_tracker', {})
        task_graph = self.data.get('task_graph', {})
        
        # Basic metrics
        metrics = {
            'sprint_id': progress.get('sprint_id', 'UNKNOWN'),
            'status': progress.get('status', 'unknown'),
            'created_date': progress.get('created_date'),
            'total_tasks': progress.get('total_tasks', 0),
            'total_features': progress.get('total_features', 0),
            'total_milestones': progress.get('total_milestones', 0),
            'tasks_completed': progress.get('tasks_completed', 0),
            'features_completed': progress.get('features_completed', 0),
            'milestones_completed': progress.get('milestones_completed', 0)
        }
        
        # Calculate percentages
        if metrics['total_tasks'] > 0:
            metrics['task_completion_rate'] = metrics['tasks_completed'] / metrics['total_tasks']
        else:
            metrics['task_completion_rate'] = 0.0
            
        if metrics['total_features'] > 0:
            metrics['feature_completion_rate'] = metrics['features_completed'] / metrics['total_features']
        else:
            metrics['feature_completion_rate'] = 0.0
        
        if metrics['total_milestones'] > 0:
            metrics['milestone_completion_rate'] = metrics['milestones_completed'] / metrics['total_milestones']
        else:
            metrics['milestone_completion_rate'] = 0.0
        
        # Current milestone info
        current_milestone = progress.get('current_milestone', {})
        if current_milestone:
            metrics['current_milestone'] = {
                'id': current_milestone.get('id'),
                'name': current_milestone.get('name'),
                'progress': current_milestone.get('progress', 0),
                'tasks_completed': current_milestone.get('tasks_completed', 0),
                'tasks_total': current_milestone.get('tasks_total', 0)
            }
            if current_milestone.get('tasks_total', 0) > 0:
                metrics['current_milestone']['completion_rate'] = (
                    current_milestone.get('tasks_completed', 0) / current_milestone.get('tasks_total', 1)
                )
        
        # Calculate days since start
        if metrics['created_date']:
            try:
                created = datetime.fromisoformat(metrics['created_date'])
                now = datetime.now()
                metrics['days_elapsed'] = (now - created).days
                
                # Calculate velocity (tasks per day)
                if metrics['days_elapsed'] > 0:
                    metrics['velocity_tasks_per_day'] = metrics['tasks_completed'] / metrics['days_elapsed']
                else:
                    metrics['velocity_tasks_per_day'] = 0.0
            except ValueError:
                metrics['days_elapsed'] = 0
                metrics['velocity_tasks_per_day'] = 0.0
        
        # Task complexity analysis
        tasks = task_graph.get('tasks', [])
        if tasks:
            # Count tasks by milestone
            milestone_tasks = {}
            blocked_tasks = 0
            high_complexity_tasks = 0
            
            for task in tasks:
                # Count by milestone
                milestone = task.get('milestone', 'UNKNOWN')
                milestone_tasks[milestone] = milestone_tasks.get(milestone, 0) + 1
                
                # Check for blockers
                if task.get('blocked', False) or task.get('dependencies'):
                    blocked_tasks += 1
                
                # Estimate complexity from description length and requirements
                scope = task.get('scope_boundaries', {})
                must_implement = scope.get('must_implement', [])
                if len(must_implement) > 5:  # High complexity heuristic
                    high_complexity_tasks += 1
            
            metrics['milestone_task_distribution'] = milestone_tasks
            metrics['blocked_tasks'] = blocked_tasks
            metrics['high_complexity_tasks'] = high_complexity_tasks
            metrics['risk_factor'] = blocked_tasks / len(tasks) if tasks else 0.0
        
        return metrics
    
    def calculate_deferred_impact(self) -> Dict[str, Any]:
        """Analyze deferred features impact"""
        deferred = self.data.get('deferred', {})
        deferred_features = deferred.get('deferred_features', [])
        
        impact = {
            'total_deferred': len(deferred_features),
            'scope_reduction': 0.0,
            'complexity_saved': 0,
            'categories': {}
        }
        
        if deferred_features:
            for feature in deferred_features:
                reason = feature.get('reason', 'other')
                impact['categories'][reason] = impact['categories'].get(reason, 0) + 1
                
                # Estimate complexity saved (simple heuristic)
                if 'complex' in feature.get('title', '').lower():
                    impact['complexity_saved'] += 2
                else:
                    impact['complexity_saved'] += 1
        
        return impact
    
    def generate_burndown_data(self) -> List[Dict[str, Any]]:
        """Generate burndown chart data"""
        progress = self.data.get('progress_tracker', {})
        total_tasks = progress.get('total_tasks', 0)
        tasks_completed = progress.get('tasks_completed', 0)
        days_elapsed = self.metrics.get('days_elapsed', 0)
        
        burndown = []
        
        # Simple linear ideal burndown
        if total_tasks > 0 and days_elapsed > 0:
            estimated_days = max(days_elapsed + 7, 14)  # Assume at least 2 weeks
            
            for day in range(estimated_days + 1):
                ideal_remaining = total_tasks * (1 - day / estimated_days)
                
                # Actual progress (simplified - only current state)
                if day <= days_elapsed:
                    actual_remaining = total_tasks - (tasks_completed * day / max(days_elapsed, 1))
                else:
                    # Project forward
                    velocity = self.metrics.get('velocity_tasks_per_day', 0)
                    projected_completed = tasks_completed + velocity * (day - days_elapsed)
                    actual_remaining = max(0, total_tasks - projected_completed)
                
                burndown.append({
                    'day': day,
                    'ideal_remaining': max(0, ideal_remaining),
                    'actual_remaining': max(0, actual_remaining)
                })
        
        return burndown
    
    def generate_sparkline(self, values: List[float]) -> str:
        """Generate ASCII sparkline from values"""
        if not values:
            return ""
        
        chars = "▁▂▃▄▅▆▇█"
        if len(values) == 1:
            return chars[4]  # Middle char for single value
        
        min_val, max_val = min(values), max(values)
        range_val = max_val - min_val
        
        if range_val == 0:
            return chars[4] * len(values)
        
        result = ""
        for val in values:
            normalized = (val - min_val) / range_val
            char_idx = min(len(chars) - 1, int(normalized * (len(chars) - 1)))
            result += chars[char_idx]
        
        return result
    
    def analyze(self, sprint_id: Optional[str] = None):
        """Main analysis function"""
        print("🔍 Loading Gustav project data...")
        self.load_all_data()
        
        print("📊 Calculating velocity metrics...")
        self.metrics = self.calculate_sprint_metrics()
        
        print("📈 Analyzing deferred impact...")
        deferred_impact = self.calculate_deferred_impact()
        
        print("🔥 Generating burndown projections...")
        burndown_data = self.generate_burndown_data()
        
        return {
            'metrics': self.metrics,
            'deferred_impact': deferred_impact,
            'burndown_data': burndown_data,
            'timestamp': datetime.now().isoformat(),
            'data_sources': list(self.data.keys())
        }
    
    def format_report(self, analysis: Dict[str, Any]) -> str:
        """Format analysis into readable report"""
        metrics = analysis['metrics']
        deferred = analysis['deferred_impact']
        burndown = analysis['burndown_data']
        
        report = f"""
# Gustav Velocity Analysis Report

## Sprint Overview
- **Sprint:** {metrics['sprint_id']}
- **Status:** {metrics['status']}
- **Created:** {metrics['created_date']}
- **Days Elapsed:** {metrics['days_elapsed']}

## 📈 Core Metrics
| Metric | Current | Total | Completion |
|--------|---------|-------|------------|
| Tasks | {metrics['tasks_completed']} | {metrics['total_tasks']} | {metrics['task_completion_rate']:.1%} |
| Features | {metrics['features_completed']} | {metrics['total_features']} | {metrics['feature_completion_rate']:.1%} |
| Milestones | {metrics['milestones_completed']} | {metrics['total_milestones']} | {metrics['milestone_completion_rate']:.1%} |

## 🎯 Current Milestone
"""
        
        if metrics.get('current_milestone'):
            cm = metrics['current_milestone']
            report += f"""- **{cm['id']}:** {cm['name']}
- **Progress:** {cm['tasks_completed']}/{cm['tasks_total']} tasks ({cm.get('completion_rate', 0):.1%})
"""
        
        report += f"""
## ⚡ Velocity Metrics
- **Task Velocity:** {metrics['velocity_tasks_per_day']:.2f} tasks/day
- **Risk Factor:** {metrics['risk_factor']:.1%} (blocked tasks)
- **Blocked Tasks:** {metrics['blocked_tasks']}
- **High Complexity:** {metrics['high_complexity_tasks']}

## 📉 Scope Management
- **Deferred Features:** {deferred['total_deferred']}
- **Complexity Saved:** {deferred['complexity_saved']} points
"""
        
        if deferred['categories']:
            report += "\n### Deferral Reasons:\n"
            for reason, count in deferred['categories'].items():
                report += f"- {reason}: {count}\n"
        
        # Burndown sparkline
        if burndown:
            ideal_values = [d['ideal_remaining'] for d in burndown[:14]]  # First 2 weeks
            actual_values = [d['actual_remaining'] for d in burndown[:14]]
            
            ideal_spark = self.generate_sparkline(ideal_values)
            actual_spark = self.generate_sparkline(actual_values)
            
            report += f"""
## 📊 Burndown Trend (14 days)
- **Ideal:**  {ideal_spark}
- **Actual:** {actual_spark}

Legend: ▁▂▃▄▅▆▇█ (low → high remaining work)
"""
        
        report += f"""
## 🔍 Data Sources
Analyzed: {', '.join(analysis['data_sources'])}
Generated: {analysis['timestamp']}

---
*Analysis generated by Gustav Velocity CLI*
"""
        
        return report.strip()


def main():
    parser = argparse.ArgumentParser(description='Gustav Velocity CLI - Fast velocity analysis')
    parser.add_argument('sprint_id', nargs='?', help='Sprint ID to analyze (optional)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('--tasks-dir', type=Path, default=Path('.tasks'), 
                       help='Path to tasks directory')
    parser.add_argument('--quiet', '-q', action='store_true', help='Suppress progress messages')
    
    args = parser.parse_args()
    
    if args.quiet:
        # Redirect prints to stderr or suppress
        class QuietPrint:
            def write(self, text): pass
            def flush(self): pass
        sys.stdout = QuietPrint()
    
    analyzer = VelocityAnalyzer(args.tasks_dir)
    
    try:
        analysis = analyzer.analyze(args.sprint_id)
        
        if args.quiet:
            sys.stdout = sys.__stdout__  # Restore stdout for final output
        
        if args.json:
            print(json.dumps(analysis, indent=2))
        else:
            print(analyzer.format_report(analysis))
            
    except Exception as e:
        print(f"❌ Analysis failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()