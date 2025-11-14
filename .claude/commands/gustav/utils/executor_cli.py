#!/usr/bin/env python3
"""
CLI Wrapper for Gustav Executor System

Provides command-line interface for the executor.md command to properly
navigate and update sprint execution state without manual JSON manipulation.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any

from dependency_analyzer import find_project_root
from json_updater import JsonUpdater


class ExecutorCLI:
    def __init__(self, tasks_dir: Optional[str] = None):
        if tasks_dir is None:
            try:
                project_root = find_project_root()
                tasks_dir = os.path.join(project_root, ".tasks")
            except ValueError as e:
                print(f"❌ {e}")
                sys.exit(1)
        self.tasks_dir = tasks_dir
        
        # Verify tasks directory exists
        if not os.path.exists(self.tasks_dir):
            print(f"❌ Gustav tasks directory not found: {self.tasks_dir}")
            print("   Make sure you're in a Gustav project with initialized .tasks directory")
            sys.exit(1)
            
        self._load_data()

    def _load_data(self):
        """Load all Gustav JSON files"""
        self.task_graph = self._load_json("task_graph.json")
        self.progress_tracker = self._load_json("progress_tracker.json")
        self.guardrail_config = self._load_json("guardrail_config.json")
        self.techstack = self._load_json("techstack_research.json")

    def _load_json(self, filename: str) -> Dict:
        """Load JSON file from tasks directory"""
        try:
            path = os.path.join(self.tasks_dir, filename)
            with open(path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def _save_json(self, filename: str, data: Dict, create_backup: bool = False):
        """Save JSON file with optional atomic backup"""
        if create_backup:
            # Use full backup protection for structural changes
            updater = JsonUpdater(self.tasks_dir)
            backup_dir = updater.create_backup()
            try:
                path = os.path.join(self.tasks_dir, filename)
                with open(path, 'w') as f:
                    json.dump(data, f, indent=2)
            except Exception as e:
                updater.restore_from_backup(backup_dir)
                raise e
        else:
            # Simple write for routine status updates
            path = os.path.join(self.tasks_dir, filename)
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)

    def get_current_status(self) -> Dict:
        """Get current sprint execution status"""
        status = {
            "sprint_status": self.progress_tracker.get("status", "unknown"),
            "current_milestone": self.progress_tracker.get("current_milestone", {}),
            "total_tasks": self.progress_tracker.get("total_tasks", 0),
            "completed_tasks": 0,
            "validation_required": False,
            "blocked_reason": None
        }

        # Count completed tasks
        for task in self.task_graph.get("tasks", []):
            if task.get("status") == "completed":
                status["completed_tasks"] += 1

        # Check if validation is required
        current_milestone = status["current_milestone"]
        if current_milestone:
            milestone_id = current_milestone.get("id")
            milestone_data = self._get_milestone_by_id(milestone_id)
            if milestone_data:
                milestone_tasks = milestone_data.get("tasks", [])
                completed_milestone_tasks = 0
                for task_id in milestone_tasks:
                    task = self._get_task_by_id(task_id)
                    if task and task.get("status") == "completed":
                        completed_milestone_tasks += 1
                
                if completed_milestone_tasks == len(milestone_tasks):
                    status["validation_required"] = True
                    status["blocked_reason"] = f"Milestone {milestone_id} complete - validation required"

        return status

    def get_next_task(self, task_id: Optional[str] = None) -> Dict:
        """Get next eligible task or specific task by ID"""
        if task_id:
            task = self._get_task_by_id(task_id)
            if not task:
                return {"error": f"Task {task_id} not found"}
            
            # Check dependencies
            dependencies_met = self._check_dependencies(task_id)
            if not dependencies_met["satisfied"]:
                return {
                    "error": f"Task {task_id} dependencies not met",
                    "missing_dependencies": dependencies_met["missing"]
                }
            
            return {"task": task, "eligible": True}

        # Find next eligible task in current milestone
        current_milestone = self.progress_tracker.get("current_milestone", {})
        milestone_id = current_milestone.get("id")
        
        if not milestone_id:
            return {"error": "No current milestone set"}

        milestone = self._get_milestone_by_id(milestone_id)
        if not milestone:
            return {"error": f"Milestone {milestone_id} not found"}

        for task_id in milestone.get("tasks", []):
            task = self._get_task_by_id(task_id)
            if not task:
                continue
                
            # Skip completed tasks
            if task.get("status") == "completed":
                continue
                
            # Check dependencies
            dependencies_met = self._check_dependencies(task_id)
            if dependencies_met["satisfied"]:
                return {"task": task, "eligible": True}

        return {"error": "No eligible tasks found in current milestone"}

    def get_task_details(self, task_id: str) -> Dict:
        """Get comprehensive task details including scope boundaries"""
        task = self._get_task_by_id(task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        # Add dependency information
        dependencies_status = self._check_dependencies(task_id)
        
        # Add milestone context
        milestone = self._get_milestone_for_task(task_id)
        
        # Add scope boundaries from guardrails
        scope_boundaries = self._get_scope_boundaries(task_id)
        
        return {
            "task": task,
            "dependencies": dependencies_status,
            "milestone": milestone,
            "scope_boundaries": scope_boundaries,
            "tech_compliance": self._check_tech_compliance(task)
        }

    def start_task(self, task_id: str) -> Dict:
        """Mark task as in-progress and update timestamps"""
        task = self._get_task_by_id(task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        # Check if task is eligible
        dependencies_status = self._check_dependencies(task_id)
        if not dependencies_status["satisfied"]:
            return {
                "error": f"Cannot start task - dependencies not met",
                "missing_dependencies": dependencies_status["missing"]
            }

        # Update task status
        for task_obj in self.task_graph.get("tasks", []):
            if task_obj.get("id") == task_id:
                task_obj["status"] = "in_progress"
                task_obj["started_at"] = datetime.now().isoformat()
                break

        # Save changes atomically
        try:
            self._save_json("task_graph.json", self.task_graph)
            return {"success": True, "task_id": task_id, "status": "in_progress"}
        except Exception as e:
            return {"error": f"Failed to start task: {e}"}

    def complete_task(self, task_id: str) -> Dict:
        """Mark task as complete and update milestone progress"""
        task = self._get_task_by_id(task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        # Update task status
        for task_obj in self.task_graph.get("tasks", []):
            if task_obj.get("id") == task_id:
                task_obj["status"] = "completed"
                task_obj["completed_at"] = datetime.now().isoformat()
                break

        # Update milestone progress in progress_tracker
        current_milestone = self.progress_tracker.get("current_milestone", {})
        milestone_id = current_milestone.get("id")
        
        if milestone_id:
            milestone = self._get_milestone_by_id(milestone_id)
            if milestone:
                milestone_tasks = milestone.get("tasks", [])
                completed_count = 0
                for mid_task_id in milestone_tasks:
                    mid_task = self._get_task_by_id(mid_task_id)
                    if mid_task and mid_task.get("status") == "completed":
                        completed_count += 1

                # Update progress tracker
                current_milestone["tasks_completed"] = completed_count
                self.progress_tracker["current_milestone"] = current_milestone

                # Check if milestone is complete
                milestone_complete = (completed_count == len(milestone_tasks))
                
        # Save changes atomically
        try:
            self._save_json("task_graph.json", self.task_graph)
            self._save_json("progress_tracker.json", self.progress_tracker)
            
            result = {"success": True, "task_id": task_id, "status": "completed"}
            if milestone_complete:
                result["milestone_complete"] = True
                result["milestone_id"] = milestone_id
                result["validation_required"] = True
                
            return result
        except Exception as e:
            return {"error": f"Failed to complete task: {e}"}

    def validate_dependencies(self, task_id: str) -> Dict:
        """Check if task dependencies are satisfied"""
        return self._check_dependencies(task_id)

    def check_scope_compliance(self, task_id: str) -> Dict:
        """Validate task against scope boundaries"""
        return self._get_scope_boundaries(task_id)

    def get_milestone_status(self, milestone_id: str) -> Dict:
        """Get milestone completion status"""
        milestone = self._get_milestone_by_id(milestone_id)
        if not milestone:
            return {"error": f"Milestone {milestone_id} not found"}

        milestone_tasks = milestone.get("tasks", [])
        completed_tasks = []
        pending_tasks = []
        
        for task_id in milestone_tasks:
            task = self._get_task_by_id(task_id)
            if task:
                if task.get("status") == "completed":
                    completed_tasks.append(task_id)
                else:
                    pending_tasks.append(task_id)

        return {
            "milestone_id": milestone_id,
            "milestone_name": milestone.get("name", "Unknown"),
            "total_tasks": len(milestone_tasks),
            "completed_tasks": len(completed_tasks),
            "pending_tasks": len(pending_tasks),
            "completion_percentage": (len(completed_tasks) / len(milestone_tasks)) * 100 if milestone_tasks else 0,
            "is_complete": len(pending_tasks) == 0,
            "completed_task_ids": completed_tasks,
            "pending_task_ids": pending_tasks
        }

    def _get_task_by_id(self, task_id: str) -> Optional[Dict]:
        """Find task by ID in task graph"""
        for task in self.task_graph.get("tasks", []):
            if task.get("id") == task_id:
                return task
        return None

    def _get_milestone_by_id(self, milestone_id: str) -> Optional[Dict]:
        """Find milestone by ID in task graph"""
        for milestone in self.task_graph.get("milestones", []):
            if milestone.get("id") == milestone_id:
                return milestone
        return None

    def _get_milestone_for_task(self, task_id: str) -> Optional[Dict]:
        """Find which milestone contains the given task"""
        for milestone in self.task_graph.get("milestones", []):
            if task_id in milestone.get("tasks", []):
                return milestone
        return None

    def _check_dependencies(self, task_id: str) -> Dict:
        """Check if all task dependencies are satisfied"""
        task = self._get_task_by_id(task_id)
        if not task:
            return {"satisfied": False, "missing": [], "error": "Task not found"}

        dependencies = task.get("dependencies", [])
        missing = []
        
        for dep_id in dependencies:
            dep_task = self._get_task_by_id(dep_id)
            if not dep_task or dep_task.get("status") != "completed":
                missing.append(dep_id)

        return {
            "satisfied": len(missing) == 0,
            "missing": missing,
            "total_dependencies": len(dependencies)
        }

    def _get_scope_boundaries(self, task_id: str) -> Dict:
        """Get scope boundaries for task from guardrails"""
        task = self._get_task_by_id(task_id)
        if not task:
            return {"error": "Task not found"}

        scope_boundaries = task.get("scope_boundaries", {})
        guardrails = self.guardrail_config.get("scope_creep_detection", {})
        
        return {
            "must_implement": scope_boundaries.get("must_implement", []),
            "must_not_implement": scope_boundaries.get("must_not_implement", []),
            "max_files": scope_boundaries.get("max_file_changes", 10),
            "forbidden_patterns": guardrails.get("forbidden_keywords", []),
            "allowed_technologies": list(self.techstack.get("stack", {}).keys())
        }

    def _check_tech_compliance(self, task: Dict) -> Dict:
        """Check if task complies with approved tech stack"""
        allowed_stack = set(self.techstack.get("stack", {}).keys())
        task_technologies = set()
        
        # Extract technologies from task context
        documentation_context = task.get("documentation_context", {})
        if "version_locks" in documentation_context:
            task_technologies.update(documentation_context["version_locks"].keys())

        non_compliant = task_technologies - allowed_stack
        
        return {
            "compliant": len(non_compliant) == 0,
            "non_compliant_technologies": list(non_compliant),
            "allowed_technologies": list(allowed_stack),
            "task_technologies": list(task_technologies)
        }


def main():
    parser = argparse.ArgumentParser(description='Gustav Executor CLI')
    parser.add_argument('action', choices=[
        'get-current-status',
        'get-next-task', 
        'get-task-details',
        'start-task',
        'complete-task',
        'validate-dependencies',
        'check-scope-compliance',
        'get-milestone-status'
    ])
    parser.add_argument('task_id', nargs='?', help='Task ID for task-specific operations')
    parser.add_argument('tasks_dir', nargs='?', help='Path to .tasks directory')
    
    args = parser.parse_args()
    
    try:
        executor = ExecutorCLI(args.tasks_dir)
        
        if args.action == 'get-current-status':
            result = executor.get_current_status()
            
        elif args.action == 'get-next-task':
            result = executor.get_next_task(args.task_id)
            
        elif args.action == 'get-task-details':
            if not args.task_id:
                print("❌ Task ID required for get-task-details")
                sys.exit(1)
            result = executor.get_task_details(args.task_id)
            
        elif args.action == 'start-task':
            if not args.task_id:
                print("❌ Task ID required for start-task")
                sys.exit(1)
            result = executor.start_task(args.task_id)
            
        elif args.action == 'complete-task':
            if not args.task_id:
                print("❌ Task ID required for complete-task")
                sys.exit(1)
            result = executor.complete_task(args.task_id)
            
        elif args.action == 'validate-dependencies':
            if not args.task_id:
                print("❌ Task ID required for validate-dependencies")
                sys.exit(1)
            result = executor.validate_dependencies(args.task_id)
            
        elif args.action == 'check-scope-compliance':
            if not args.task_id:
                print("❌ Task ID required for check-scope-compliance")
                sys.exit(1)
            result = executor.check_scope_compliance(args.task_id)
            
        elif args.action == 'get-milestone-status':
            if not args.task_id:  # Using task_id parameter for milestone_id
                print("❌ Milestone ID required for get-milestone-status")
                sys.exit(1)
            result = executor.get_milestone_status(args.task_id)
            
        print(json.dumps(result, indent=2))
        
        # Exit with error code if result contains an error
        if isinstance(result, dict) and "error" in result:
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Executor CLI error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()