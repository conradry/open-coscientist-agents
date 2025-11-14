#!/usr/bin/env python3
"""
CLI Wrapper for Gustav Enhancement System

Provides command-line interface for the enhance.md command to properly
integrate with Gustav utility scripts for feature enhancement.
"""

import argparse
import json
import os
import sys
from typing import Optional

from dependency_analyzer import DependencyAnalyzer, find_project_root
from task_inserter import TaskInserter
from json_updater import JsonUpdater


def create_backup(tasks_dir: str) -> str:
    """Create backup and return backup directory path"""
    try:
        updater = JsonUpdater(tasks_dir)
        backup_dir = updater.create_backup()
        print(f"✅ Backup created: {backup_dir}")
        return backup_dir
    except Exception as e:
        print(f"❌ Backup creation failed: {e}")
        sys.exit(1)


def get_backup_path(tasks_dir: str) -> str:
    """Get the path where backup would be created"""
    updater = JsonUpdater(tasks_dir)
    return updater.backup_dir


def analyze_feature(feature_description: str, tasks_dir: Optional[str] = None) -> dict:
    """Analyze feature and return analysis as JSON"""
    try:
        analyzer = DependencyAnalyzer(tasks_dir)
        analysis = analyzer.analyze_feature(feature_description)
        
        # Convert to dict for JSON serialization
        analysis_dict = {
            "feature_id": analysis.feature_id,
            "description": analysis.description,
            "estimated_tasks": analysis.estimated_tasks,
            "complexity": analysis.complexity,
            "new_technologies": analysis.new_technologies,
            "dependencies": [
                {
                    "task_id": dep.task_id,
                    "dependency_type": dep.dependency_type.value,
                    "reason": dep.reason,
                    "strength": dep.strength
                } for dep in analysis.dependencies
            ],
            "conflicts": analysis.conflicts
        }
        
        return analysis_dict
        
    except Exception as e:
        print(f"❌ Feature analysis failed: {e}")
        sys.exit(1)


def show_impact_preview(feature_description: str, tasks_dir: Optional[str] = None) -> None:
    """Show impact preview of the enhancement"""
    try:
        analyzer = DependencyAnalyzer(tasks_dir)
        analysis = analyzer.analyze_feature(feature_description)
        
        inserter = TaskInserter(tasks_dir)
        options = inserter.find_insertion_options(analysis)
        
        if not options:
            print("❌ No suitable insertion options found")
            sys.exit(1)
        
        # Use the best option for preview
        best_option = options[0]
        plan = inserter.create_insertion_plan(analysis, best_option)
        
        print("📊 Enhancement Impact Preview:")
        print(f"├─ Tasks to add: {len(plan.new_tasks)}")
        print(f"├─ Target milestone: {best_option.target_milestone_id}")
        print(f"├─ Strategy: {best_option.strategy.value}")
        print(f"├─ Capacity after: {best_option.capacity_after}")
        print(f"├─ Dependencies satisfied: {'Yes' if best_option.dependencies_satisfied else 'No'}")
        print(f"├─ New technologies: {len(analysis.new_technologies)}")
        print(f"└─ Complexity: {analysis.complexity}")
        
        if analysis.conflicts:
            print("⚠️  Potential conflicts:")
            for conflict in analysis.conflicts:
                print(f"   - {conflict}")
                
    except Exception as e:
        print(f"❌ Impact preview failed: {e}")
        sys.exit(1)


def apply_enhancement(
    feature_description: str, 
    tasks_dir: str,
    backup_dir: Optional[str] = None
) -> dict:
    """Apply enhancement and return summary"""
    try:
        # Step 1: Analyze feature
        analyzer = DependencyAnalyzer(tasks_dir)
        analysis = analyzer.analyze_feature(feature_description)
        
        # Step 2: Find insertion options
        inserter = TaskInserter(tasks_dir)
        options = inserter.find_insertion_options(analysis)
        
        if not options:
            print("❌ No suitable insertion options found")
            sys.exit(1)
        
        # Step 3: Create insertion plan (use best option)
        plan = inserter.create_insertion_plan(analysis, options[0])
        
        # Step 4: Apply changes atomically
        updater = JsonUpdater(tasks_dir)
        summary = updater.apply_enhancement(analysis, plan)
        
        # Return summary as dict
        summary_dict = {
            "files_updated": summary.files_updated,
            "backup_location": summary.backup_location,
            "new_task_ids": summary.new_task_ids,
            "milestones_affected": summary.milestones_affected,
            "total_tasks_before": summary.total_tasks_before,
            "total_tasks_after": summary.total_tasks_after
        }
        
        print("🎉 Enhancement complete!")
        print(f"📁 Files updated: {', '.join(summary.files_updated)}")
        print(f"📦 Backup location: {summary.backup_location}")
        print(f"🎯 Tasks added: {len(summary.new_task_ids)}")
        
        return summary_dict
        
    except Exception as e:
        print(f"❌ Enhancement failed: {e}")
        # Try to restore from backup if available
        if backup_dir:
            try:
                updater = JsonUpdater(tasks_dir)
                if updater.restore_from_backup(backup_dir):
                    print(f"✅ Restored from backup: {backup_dir}")
            except:
                print("❌ Could not restore from backup")
        sys.exit(1)


def get_project_state(tasks_dir: str) -> dict:
    """Get current project state for context"""
    try:
        # Load task graph and progress tracker
        task_graph_path = os.path.join(tasks_dir, "task_graph.json")
        progress_path = os.path.join(tasks_dir, "progress_tracker.json")
        deferred_path = os.path.join(tasks_dir, "deferred.json")
        
        state = {}
        
        if os.path.exists(progress_path):
            with open(progress_path, 'r') as f:
                progress = json.load(f)
                current_milestone = progress.get('current_milestone', {})
                state['current_milestone'] = {
                    'id': current_milestone.get('id', 'Unknown'),
                    'name': current_milestone.get('name', 'Unknown'),
                    'tasks_completed': current_milestone.get('tasks_completed', 0),
                    'tasks_total': current_milestone.get('tasks_total', 0),
                    'remaining_capacity': max(0, 5 - current_milestone.get('tasks_total', 0))  # Assuming max 5 tasks per milestone
                }
        
        if os.path.exists(deferred_path):
            with open(deferred_path, 'r') as f:
                deferred = json.load(f)
                state['deferred_features'] = deferred.get('deferred_features', [])
        
        if os.path.exists(task_graph_path):
            with open(task_graph_path, 'r') as f:
                task_graph = json.load(f)
                state['total_tasks'] = len(task_graph.get('tasks', []))
                state['total_milestones'] = len(task_graph.get('milestones', []))
        
        return state
        
    except Exception as e:
        print(f"❌ Could not get project state: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Gustav Enhancement CLI')
    parser.add_argument('action', choices=[
        'create-backup', 
        'get-backup-path', 
        'analyze-feature', 
        'show-impact',
        'apply-enhancement',
        'get-project-state'
    ])
    parser.add_argument('feature_description', nargs='?', help='Feature description')
    parser.add_argument('tasks_dir', nargs='?', help='Path to .tasks directory')
    parser.add_argument('--backup-dir', help='Backup directory for restore')
    
    args = parser.parse_args()
    
    # Find tasks directory if not provided
    if not args.tasks_dir:
        try:
            project_root = find_project_root()
            args.tasks_dir = os.path.join(project_root, '.tasks')
        except ValueError as e:
            print(f"❌ {e}")
            sys.exit(1)
    
    if args.action == 'create-backup':
        backup_path = create_backup(args.tasks_dir)
        print(backup_path)
        
    elif args.action == 'get-backup-path':
        backup_path = get_backup_path(args.tasks_dir)
        print(backup_path)
        
    elif args.action == 'analyze-feature':
        if not args.feature_description:
            print("❌ Feature description required for analysis")
            sys.exit(1)
        analysis = analyze_feature(args.feature_description, args.tasks_dir)
        print(json.dumps(analysis, indent=2))
        
    elif args.action == 'show-impact':
        if not args.feature_description:
            print("❌ Feature description required for impact preview")
            sys.exit(1)
        show_impact_preview(args.feature_description, args.tasks_dir)
        
    elif args.action == 'apply-enhancement':
        if not args.feature_description:
            print("❌ Feature description required for enhancement")
            sys.exit(1)
        summary = apply_enhancement(args.feature_description, args.tasks_dir, args.backup_dir)
        print(json.dumps(summary, indent=2))
        
    elif args.action == 'get-project-state':
        state = get_project_state(args.tasks_dir)
        print(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()