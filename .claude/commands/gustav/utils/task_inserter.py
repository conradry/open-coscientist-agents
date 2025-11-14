#!/usr/bin/env python3
"""
Smart Task Insertion Logic for Gustav Enhancement System

Determines optimal placement of new tasks in existing milestone structures
while maintaining workflow integrity and milestone boundaries.
"""

import json
import os
import copy
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

from dependency_analyzer import FeatureAnalysis, TaskDependency, find_project_root

class InsertionStrategy(Enum):
    CURRENT_MILESTONE = "current_milestone"
    FUTURE_MILESTONE = "future_milestone" 
    NEW_MILESTONE = "new_milestone"
    SPLIT_MILESTONE = "split_milestone"

@dataclass
class InsertionOption:
    strategy: InsertionStrategy
    target_milestone_id: str
    position: int
    reasoning: str
    impact_score: int  # Lower is better
    capacity_after: int
    dependencies_satisfied: bool

@dataclass
class InsertionPlan:
    selected_option: InsertionOption
    new_tasks: List[Dict]
    updated_milestones: List[Dict]
    impact_summary: Dict

class TaskInserter:
    def __init__(self, tasks_dir: str = None):
        if tasks_dir is None:
            try:
                project_root = find_project_root()
                tasks_dir = os.path.join(project_root, ".tasks")
            except ValueError as e:
                print(f"❌ {e}")
                import sys
                sys.exit(1)
        self.tasks_dir = tasks_dir
        self.task_graph = self._load_json("task_graph.json")
        self.progress_tracker = self._load_json("progress_tracker.json")
        
    def _load_json(self, filename: str) -> Dict:
        """Load JSON file from tasks directory"""
        with open(f"{self.tasks_dir}/{filename}", 'r') as f:
            return json.load(f)
    
    def find_insertion_options(self, analysis: FeatureAnalysis) -> List[InsertionOption]:
        """
        Generate all possible insertion options for a feature,
        ranked by impact and feasibility.
        """
        options = []
        milestones = self.task_graph.get('milestones', [])
        strategy = self.task_graph.get('milestone_strategy', {})
        max_tasks = strategy.get('max_tasks_per_milestone', 5)
        
        current_milestone_id = self.progress_tracker.get('current_milestone', {}).get('id')
        
        # Option 1: Insert in current milestone (if capacity and dependencies allow)
        if current_milestone_id:
            current_option = self._evaluate_current_milestone_insertion(
                analysis, current_milestone_id, max_tasks
            )
            if current_option:
                options.append(current_option)
        
        # Option 2: Insert in future milestones
        future_options = self._evaluate_future_milestone_insertions(
            analysis, milestones, max_tasks
        )
        options.extend(future_options)
        
        # Option 3: Create new milestone
        new_milestone_option = self._evaluate_new_milestone_creation(
            analysis, milestones
        )
        if new_milestone_option:
            options.append(new_milestone_option)
        
        # Option 4: Split existing milestone
        split_options = self._evaluate_milestone_splits(
            analysis, milestones, max_tasks
        )
        options.extend(split_options)
        
        # Sort by impact score (lower is better)
        options.sort(key=lambda x: (x.impact_score, not x.dependencies_satisfied))
        
        return options
    
    def _evaluate_current_milestone_insertion(
        self, 
        analysis: FeatureAnalysis, 
        milestone_id: str, 
        max_tasks: int
    ) -> Optional[InsertionOption]:
        """Evaluate inserting in current milestone"""
        
        milestone = self._find_milestone(milestone_id)
        if not milestone:
            return None
            
        current_tasks = len(milestone.get('tasks', []))
        capacity = max_tasks - current_tasks
        
        # Check if there's enough capacity
        if capacity < analysis.estimated_tasks:
            return None
        
        # Check if dependencies are satisfied
        deps_satisfied = self._check_dependencies_satisfied_in_milestone(
            analysis.dependencies, milestone_id, include_previous=True
        )
        
        # Calculate impact score
        impact_score = 1 if deps_satisfied else 10  # Lower is better
        
        # Find insertion position (before validation task)
        position = self._find_insertion_position_in_milestone(milestone)
        
        return InsertionOption(
            strategy=InsertionStrategy.CURRENT_MILESTONE,
            target_milestone_id=milestone_id,
            position=position,
            reasoning=f"Insert in current milestone {milestone_id} - has capacity for {capacity} more tasks",
            impact_score=impact_score,
            capacity_after=capacity - analysis.estimated_tasks,
            dependencies_satisfied=deps_satisfied
        )
    
    def _evaluate_future_milestone_insertions(
        self, 
        analysis: FeatureAnalysis, 
        milestones: List[Dict], 
        max_tasks: int
    ) -> List[InsertionOption]:
        """Evaluate inserting in future milestones"""
        options = []
        current_milestone_id = self.progress_tracker.get('current_milestone', {}).get('id')
        
        # Find current milestone index
        current_index = -1
        for i, milestone in enumerate(milestones):
            if milestone.get('id') == current_milestone_id:
                current_index = i
                break
        
        # Evaluate future milestones
        for i in range(current_index + 1, len(milestones)):
            milestone = milestones[i]
            milestone_id = milestone.get('id')
            current_tasks = len(milestone.get('tasks', []))
            capacity = max_tasks - current_tasks
            
            if capacity >= analysis.estimated_tasks:
                # Check dependencies considering all previous milestones
                deps_satisfied = self._check_dependencies_satisfied_before_milestone(
                    analysis.dependencies, i, milestones
                )
                
                # Calculate impact score based on distance and capacity
                distance_penalty = (i - current_index) * 2
                capacity_bonus = capacity - analysis.estimated_tasks
                impact_score = distance_penalty - capacity_bonus + (0 if deps_satisfied else 10)
                
                position = self._find_insertion_position_in_milestone(milestone)
                
                options.append(InsertionOption(
                    strategy=InsertionStrategy.FUTURE_MILESTONE,
                    target_milestone_id=milestone_id,
                    position=position,
                    reasoning=f"Insert in future milestone {milestone_id} - dependencies satisfied, good capacity",
                    impact_score=impact_score,
                    capacity_after=capacity - analysis.estimated_tasks,
                    dependencies_satisfied=deps_satisfied
                ))
        
        return options
    
    def _evaluate_new_milestone_creation(
        self, 
        analysis: FeatureAnalysis, 
        milestones: List[Dict]
    ) -> Optional[InsertionOption]:
        """Evaluate creating a new milestone for this feature"""
        
        # Only consider new milestone if feature has 3+ tasks or is high complexity
        if analysis.estimated_tasks < 3 and analysis.complexity != "high":
            return None
        
        # Find optimal position for new milestone
        optimal_position = self._find_optimal_new_milestone_position(
            analysis.dependencies, milestones
        )
        
        if optimal_position is None:
            return None
        
        # Calculate impact score
        impact_score = 15 + (len(milestones) * 2)  # Creating milestone has higher impact
        
        # Check if dependencies would be satisfied
        deps_satisfied = self._check_dependencies_satisfied_before_position(
            analysis.dependencies, optimal_position, milestones
        )
        
        new_milestone_id = f"M{len(milestones) + 1}"
        
        return InsertionOption(
            strategy=InsertionStrategy.NEW_MILESTONE,
            target_milestone_id=new_milestone_id,
            position=optimal_position,
            reasoning=f"Create new milestone {new_milestone_id} - feature complex enough to warrant own milestone",
            impact_score=impact_score,
            capacity_after=5 - analysis.estimated_tasks,  # Assume 5-task milestone
            dependencies_satisfied=deps_satisfied
        )
    
    def _evaluate_milestone_splits(
        self, 
        analysis: FeatureAnalysis, 
        milestones: List[Dict], 
        max_tasks: int
    ) -> List[InsertionOption]:
        """Evaluate splitting existing milestones to make room"""
        options = []
        
        # Only consider splits for medium/high complexity features
        if analysis.complexity == "low":
            return options
        
        for i, milestone in enumerate(milestones):
            current_tasks = len(milestone.get('tasks', []))
            
            # Only split if milestone is near capacity
            if current_tasks >= max_tasks - 1:
                split_option = self._evaluate_milestone_split(
                    analysis, milestone, i, milestones
                )
                if split_option:
                    options.append(split_option)
        
        return options
    
    def _evaluate_milestone_split(
        self, 
        analysis: FeatureAnalysis, 
        milestone: Dict, 
        milestone_index: int, 
        milestones: List[Dict]
    ) -> Optional[InsertionOption]:
        """Evaluate splitting a specific milestone"""
        
        milestone_id = milestone.get('id')
        tasks = milestone.get('tasks', [])
        
        # Don't split milestones with too few tasks
        if len(tasks) < 4:
            return None
        
        # Check dependencies
        deps_satisfied = self._check_dependencies_satisfied_before_position(
            analysis.dependencies, milestone_index, milestones
        )
        
        # High impact score due to structural changes
        impact_score = 20 + (milestone_index * 2)
        
        return InsertionOption(
            strategy=InsertionStrategy.SPLIT_MILESTONE,
            target_milestone_id=f"{milestone_id}-SPLIT",
            position=milestone_index,
            reasoning=f"Split milestone {milestone_id} to make room for feature",
            impact_score=impact_score,
            capacity_after=2,  # Assume split creates room
            dependencies_satisfied=deps_satisfied
        )
    
    def _find_milestone(self, milestone_id: str) -> Optional[Dict]:
        """Find milestone by ID"""
        for milestone in self.task_graph.get('milestones', []):
            if milestone.get('id') == milestone_id:
                return milestone
        return None
    
    def _find_insertion_position_in_milestone(self, milestone: Dict) -> int:
        """Find optimal position within milestone (usually before validation)"""
        tasks = milestone.get('tasks', [])
        
        # Insert before validation tasks (which start with T-VAL-)
        for i, task_id in enumerate(tasks):
            if task_id.startswith('T-VAL-'):
                return i
        
        # If no validation task, insert at end
        return len(tasks)
    
    def _check_dependencies_satisfied_in_milestone(
        self, 
        dependencies: List[TaskDependency], 
        milestone_id: str, 
        include_previous: bool = False
    ) -> bool:
        """Check if all required dependencies would be satisfied in/before milestone"""
        
        if not dependencies:
            return True
        
        # Get all task IDs that would be completed before this insertion point
        completed_tasks = set()
        
        if include_previous:
            # Add all tasks from previous milestones
            current_found = False
            for milestone in self.task_graph.get('milestones', []):
                if milestone.get('id') == milestone_id:
                    current_found = True
                    break
                completed_tasks.update(milestone.get('tasks', []))
        
        # Add tasks from current milestone (before insertion point)
        milestone = self._find_milestone(milestone_id)
        if milestone:
            position = self._find_insertion_position_in_milestone(milestone)
            milestone_tasks = milestone.get('tasks', [])
            completed_tasks.update(milestone_tasks[:position])
        
        # Check if all required dependencies are satisfied
        for dep in dependencies:
            if dep.strength == "required" and dep.task_id not in completed_tasks:
                return False
        
        return True
    
    def _check_dependencies_satisfied_before_milestone(
        self, 
        dependencies: List[TaskDependency], 
        milestone_index: int, 
        milestones: List[Dict]
    ) -> bool:
        """Check if dependencies are satisfied before given milestone index"""
        
        if not dependencies:
            return True
        
        # Collect all tasks from milestones before the target
        completed_tasks = set()
        for i in range(milestone_index):
            if i < len(milestones):
                completed_tasks.update(milestones[i].get('tasks', []))
        
        # Check required dependencies
        for dep in dependencies:
            if dep.strength == "required" and dep.task_id not in completed_tasks:
                return False
        
        return True
    
    def _check_dependencies_satisfied_before_position(
        self, 
        dependencies: List[TaskDependency], 
        position: int, 
        milestones: List[Dict]
    ) -> bool:
        """Check if dependencies satisfied before given milestone position"""
        return self._check_dependencies_satisfied_before_milestone(
            dependencies, position, milestones
        )
    
    def _find_optimal_new_milestone_position(
        self, 
        dependencies: List[TaskDependency], 
        milestones: List[Dict]
    ) -> Optional[int]:
        """Find optimal position for new milestone"""
        
        if not dependencies:
            # If no dependencies, can insert anywhere after current
            current_milestone_id = self.progress_tracker.get('current_milestone', {}).get('id')
            for i, milestone in enumerate(milestones):
                if milestone.get('id') == current_milestone_id:
                    return i + 1
            return len(milestones)  # End if current not found
        
        # Find minimum position where all required deps are satisfied
        min_position = 0
        for dep in dependencies:
            if dep.strength == "required":
                # Find which milestone contains this dependency
                for i, milestone in enumerate(milestones):
                    if dep.task_id in milestone.get('tasks', []):
                        min_position = max(min_position, i + 1)
                        break
        
        return min_position if min_position <= len(milestones) else None
    
    def create_insertion_plan(
        self, 
        analysis: FeatureAnalysis, 
        selected_option: InsertionOption
    ) -> InsertionPlan:
        """Create detailed insertion plan based on selected option"""
        
        # Generate new tasks based on analysis
        new_tasks = self._generate_tasks_from_analysis(analysis, selected_option)
        
        # Create updated milestone structure
        updated_milestones = self._create_updated_milestones(
            selected_option, new_tasks, analysis
        )
        
        # Generate impact summary
        impact_summary = {
            "strategy": selected_option.strategy.value,
            "tasks_added": len(new_tasks),
            "milestones_affected": self._get_affected_milestones(selected_option),
            "capacity_impact": selected_option.capacity_after,
            "dependencies_satisfied": selected_option.dependencies_satisfied,
            "structural_changes": selected_option.strategy in [
                InsertionStrategy.NEW_MILESTONE, 
                InsertionStrategy.SPLIT_MILESTONE
            ]
        }
        
        return InsertionPlan(
            selected_option=selected_option,
            new_tasks=new_tasks,
            updated_milestones=updated_milestones,
            impact_summary=impact_summary
        )
    
    def _generate_tasks_from_analysis(
        self, 
        analysis: FeatureAnalysis, 
        option: InsertionOption
    ) -> List[Dict]:
        """Generate task objects from feature analysis"""
        tasks = []
        
        for i in range(analysis.estimated_tasks):
            task_id = f"T-ENH-{analysis.feature_id.split('-')[2]}-{i+1:03d}"
            
            # Create task based on template
            task = {
                "id": task_id,
                "title": f"Implement {analysis.description} - Task {i+1}",
                "prd_traceability": {
                    "feature_id": analysis.feature_id,
                    "prd_lines": ["ENHANCEMENT"],
                    "original_requirement": analysis.description
                },
                "scope_boundaries": {
                    "must_implement": [f"Part {i+1} of {analysis.description}"],
                    "must_not_implement": ["Scope creep beyond enhancement"],
                    "out_of_scope_check": "BLOCK if not in must_implement"
                },
                "documentation_context": {
                    "primary_docs": [],
                    "version_locks": {},
                    "forbidden_patterns": ["experimental features"]
                },
                "hallucination_guards": {
                    "verify_before_use": ["API signatures", "configuration options"],
                    "forbidden_assumptions": ["no defaults assumed"]
                },
                "context_drift_prevention": {
                    "task_boundaries": f"This task ONLY handles part {i+1} of enhancement",
                    "refer_to_other_tasks": {},
                    "max_file_changes": 3,
                    "if_exceeds": "STOP and verify scope"
                },
                "milestone_metadata": {
                    "milestone_id": option.target_milestone_id,
                    "milestone_name": self._get_milestone_name(option.target_milestone_id),
                    "is_milestone_critical": False,
                    "can_defer": True,
                    "milestone_position": option.position + i
                },
                "enhancement_metadata": {
                    "enhancement_id": f"ENH-{analysis.feature_id}",
                    "added_date": "2025-08-13",  # TODO: Use actual date
                    "insertion_reason": option.reasoning,
                    "impact_assessment": analysis.complexity
                }
            }
            
            tasks.append(task)
        
        return tasks
    
    def _create_updated_milestones(
        self, 
        option: InsertionOption, 
        new_tasks: List[Dict], 
        analysis: FeatureAnalysis
    ) -> List[Dict]:
        """Create updated milestone structure with new tasks inserted"""
        
        milestones = copy.deepcopy(self.task_graph.get('milestones', []))
        new_task_ids = [task['id'] for task in new_tasks]
        
        if option.strategy == InsertionStrategy.NEW_MILESTONE:
            # Create entirely new milestone
            new_milestone = {
                "id": option.target_milestone_id,
                "name": f"Enhancement: {analysis.description[:30]}...",
                "description": f"Enhancement milestone for: {analysis.description}",
                "tasks": new_task_ids + [f"T-VAL-{option.target_milestone_id}"],
                "launch_ready": True,
                "validation_criteria": {
                    "enhancement_works": True,
                    "no_regressions": True
                },
                "human_review_required": True,
                "rollback_point": True
            }
            
            # Insert at appropriate position
            milestones.insert(option.position, new_milestone)
            
        else:
            # Insert into existing milestone
            target_milestone = None
            for milestone in milestones:
                if milestone.get('id') == option.target_milestone_id:
                    target_milestone = milestone
                    break
            
            if target_milestone:
                tasks = target_milestone.get('tasks', [])
                # Insert new tasks at specified position
                for i, task_id in enumerate(new_task_ids):
                    tasks.insert(option.position + i, task_id)
                target_milestone['tasks'] = tasks
        
        return milestones
    
    def _get_milestone_name(self, milestone_id: str) -> str:
        """Get milestone name or generate one for new milestones"""
        milestone = self._find_milestone(milestone_id)
        if milestone:
            return milestone.get('name', milestone_id)
        return f"Enhancement Milestone {milestone_id}"
    
    def _get_affected_milestones(self, option: InsertionOption) -> List[str]:
        """Get list of milestone IDs affected by this insertion"""
        if option.strategy == InsertionStrategy.NEW_MILESTONE:
            return [option.target_milestone_id]
        else:
            return [option.target_milestone_id]

def main():
    """Test the task inserter"""
    import sys
    from dependency_analyzer import DependencyAnalyzer
    
    if len(sys.argv) < 2:
        print("Usage: task_inserter.py 'feature description'")
        sys.exit(1)
    
    feature_desc = sys.argv[1]
    
    # Analyze the feature
    analyzer = DependencyAnalyzer()
    analysis = analyzer.analyze_feature(feature_desc)
    
    # Find insertion options
    inserter = TaskInserter()
    options = inserter.find_insertion_options(analysis)
    
    print(f"Insertion Options for: {analysis.description}")
    print(f"Feature Complexity: {analysis.complexity} ({analysis.estimated_tasks} tasks)")
    print()
    
    for i, option in enumerate(options, 1):
        print(f"Option {i}: {option.strategy.value}")
        print(f"  Target: {option.target_milestone_id}")
        print(f"  Position: {option.position}")
        print(f"  Impact Score: {option.impact_score}")
        print(f"  Dependencies Satisfied: {option.dependencies_satisfied}")
        print(f"  Reasoning: {option.reasoning}")
        print()
    
    # Create plan for best option
    if options:
        best_option = options[0]
        plan = inserter.create_insertion_plan(analysis, best_option)
        print("Recommended Plan:")
        print(f"  Strategy: {plan.selected_option.strategy.value}")
        print(f"  Tasks to Add: {len(plan.new_tasks)}")
        print(f"  Milestones Updated: {len(plan.updated_milestones)}")
        print(f"  Impact Summary: {plan.impact_summary}")

if __name__ == "__main__":
    main()