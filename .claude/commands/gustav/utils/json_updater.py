#!/usr/bin/env python3
"""
Atomic JSON File Update System for Gustav Enhancement

Handles consistent updates across all .tasks/*.json files when adding
new features to maintain data integrity and consistency.
"""

import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass

from dependency_analyzer import FeatureAnalysis, find_project_root
from task_inserter import InsertionPlan

@dataclass
class UpdateSummary:
    files_updated: List[str]
    backup_location: str
    new_task_ids: List[str]
    milestones_affected: List[str]
    total_tasks_before: int
    total_tasks_after: int

class JsonUpdater:
    def __init__(self, tasks_dir: Optional[str] = None):
        if tasks_dir is None:
            try:
                project_root = find_project_root()
                tasks_dir = os.path.join(project_root, ".tasks")
            except ValueError as e:
                print(f"❌ {e}")
                import sys
                sys.exit(1)
        self.tasks_dir = tasks_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_dir = f"{tasks_dir}/backup/{self.timestamp}"
        
    def create_backup(self) -> str:
        """Create backup of all JSON files before modification"""
        os.makedirs(self.backup_dir, exist_ok=True)
        
        json_files = [
            "task_graph.json",
            "progress_tracker.json", 
            "techstack_research.json",
            "guardrail_config.json",
            "deferred.json",
            "prd_digest.json"
        ]
        
        for filename in json_files:
            source_path = f"{self.tasks_dir}/{filename}"
            if os.path.exists(source_path):
                shutil.copy2(source_path, f"{self.backup_dir}/{filename}")
        
        return self.backup_dir
    
    def restore_from_backup(self, backup_dir: str) -> bool:
        """Restore files from backup in case of failure"""
        try:
            for filename in os.listdir(backup_dir):
                if filename.endswith('.json'):
                    shutil.copy2(f"{backup_dir}/{filename}", f"{self.tasks_dir}/{filename}")
            return True
        except Exception as e:
            print(f"Error restoring from backup: {e}")
            return False
    
    def apply_enhancement(
        self, 
        analysis: FeatureAnalysis, 
        plan: InsertionPlan
    ) -> UpdateSummary:
        """Apply enhancement plan to all JSON files atomically"""
        
        # Create backup first
        backup_location = self.create_backup()
        
        try:
            # Track what we're updating
            files_updated = []
            new_task_ids = [task['id'] for task in plan.new_tasks]
            
            # Load current data
            current_data = self._load_all_json_files()
            total_tasks_before = len(current_data['task_graph'].get('tasks', []))
            
            # Update each file
            updated_task_graph = self._update_task_graph(
                current_data['task_graph'], plan
            )
            if updated_task_graph != current_data['task_graph']:
                self._save_json("task_graph.json", updated_task_graph)
                files_updated.append("task_graph.json")
            
            updated_progress = self._update_progress_tracker(
                current_data['progress_tracker'], plan, analysis
            )
            if updated_progress != current_data['progress_tracker']:
                self._save_json("progress_tracker.json", updated_progress)
                files_updated.append("progress_tracker.json")
            
            updated_guardrails = self._update_guardrail_config(
                current_data['guardrail_config'], plan, analysis
            )
            if updated_guardrails != current_data['guardrail_config']:
                self._save_json("guardrail_config.json", updated_guardrails)
                files_updated.append("guardrail_config.json")
            
            updated_prd_digest = self._update_prd_digest(
                current_data['prd_digest'], plan, analysis
            )
            if updated_prd_digest != current_data['prd_digest']:
                self._save_json("prd_digest.json", updated_prd_digest)
                files_updated.append("prd_digest.json")
            
            # Update deferred.json if reactivating a feature
            updated_deferred = self._update_deferred_features(
                current_data['deferred'], analysis
            )
            if updated_deferred != current_data['deferred']:
                self._save_json("deferred.json", updated_deferred)
                files_updated.append("deferred.json")
            
            # Update techstack if new technologies were added
            updated_techstack = self._update_techstack_research(
                current_data['techstack_research'], analysis
            )
            if updated_techstack != current_data['techstack_research']:
                self._save_json("techstack_research.json", updated_techstack)
                files_updated.append("techstack_research.json")
            
            # Validate all files after update
            self._validate_json_consistency()
            
            total_tasks_after = len(updated_task_graph.get('tasks', []))
            
            return UpdateSummary(
                files_updated=files_updated,
                backup_location=backup_location,
                new_task_ids=new_task_ids,
                milestones_affected=plan.impact_summary.get('milestones_affected', []),
                total_tasks_before=total_tasks_before,
                total_tasks_after=total_tasks_after
            )
            
        except Exception as e:
            # Restore from backup on any error
            print(f"Error during update, restoring from backup: {e}")
            self.restore_from_backup(backup_location)
            raise
    
    def _load_all_json_files(self) -> Dict[str, Dict]:
        """Load all JSON files into memory"""
        files = {
            'task_graph': 'task_graph.json',
            'progress_tracker': 'progress_tracker.json',
            'techstack_research': 'techstack_research.json',
            'guardrail_config': 'guardrail_config.json',
            'deferred': 'deferred.json',
            'prd_digest': 'prd_digest.json'
        }
        
        data = {}
        for key, filename in files.items():
            path = f"{self.tasks_dir}/{filename}"
            if os.path.exists(path):
                with open(path, 'r') as f:
                    data[key] = json.load(f)
            else:
                data[key] = {}
        
        return data
    
    def _save_json(self, filename: str, data: Dict) -> None:
        """Save JSON data to file with pretty formatting"""
        path = f"{self.tasks_dir}/{filename}"
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _update_task_graph(self, task_graph: Dict, plan: InsertionPlan) -> Dict:
        """Update task_graph.json with new tasks and milestones"""
        updated = task_graph.copy()
        
        # Add new tasks to tasks array
        existing_tasks = updated.get('tasks', [])
        existing_tasks.extend(plan.new_tasks)
        updated['tasks'] = existing_tasks
        
        # Update milestones
        updated['milestones'] = plan.updated_milestones
        
        # Update scope enforcement
        scope_enforcement = updated.get('scope_enforcement', {})
        scope_enforcement['total_tasks'] = len(existing_tasks)
        
        # Recalculate complexity score (simple heuristic)
        complexity_score = scope_enforcement.get('complexity_score', 0)
        for task in plan.new_tasks:
            enhancement_meta = task.get('enhancement_metadata', {})
            impact = enhancement_meta.get('impact_assessment', 'low')
            if impact == 'high':
                complexity_score += 3
            elif impact == 'medium':
                complexity_score += 2
            else:
                complexity_score += 1
        
        scope_enforcement['complexity_score'] = complexity_score
        updated['scope_enforcement'] = scope_enforcement
        
        return updated
    
    def _update_progress_tracker(
        self, 
        progress_tracker: Dict, 
        plan: InsertionPlan, 
        analysis: FeatureAnalysis
    ) -> Dict:
        """Update progress_tracker.json with new task counts and status"""
        updated = progress_tracker.copy()
        
        # Update totals
        updated['total_tasks'] = updated.get('total_tasks', 0) + len(plan.new_tasks)
        
        # Update current milestone if tasks were added there
        current_milestone = updated.get('current_milestone', {})
        if current_milestone.get('id') == plan.selected_option.target_milestone_id:
            current_milestone['tasks_total'] = current_milestone.get('tasks_total', 0) + len(plan.new_tasks)
            updated['current_milestone'] = current_milestone
        
        # Add enhancement tracking
        enhancements = updated.get('enhancements', [])
        enhancement_record = {
            "enhancement_id": f"ENH-{self.timestamp}",
            "feature_id": analysis.feature_id,
            "description": analysis.description,
            "added_date": datetime.now().isoformat()[:10],
            "tasks_added": len(plan.new_tasks),
            "milestone_target": plan.selected_option.target_milestone_id,
            "complexity": analysis.complexity
        }
        enhancements.append(enhancement_record)
        updated['enhancements'] = enhancements
        
        return updated
    
    def _update_guardrail_config(
        self, 
        guardrail_config: Dict, 
        plan: InsertionPlan, 
        analysis: FeatureAnalysis
    ) -> Dict:
        """Update guardrail_config.json with new protection rules if needed"""
        updated = guardrail_config.copy()
        
        # Add enhancement-specific protection if high complexity
        if analysis.complexity == 'high':
            scope_creep_detection = updated.get('scope_creep_detection', {})
            forbidden_keywords = scope_creep_detection.get('forbidden_keywords', [])
            
            # Add keywords to prevent scope creep in enhancement
            enhancement_keywords = [
                f"beyond-{analysis.feature_id.lower()}",
                "additional-features",
                "extra-functionality"
            ]
            
            for keyword in enhancement_keywords:
                if keyword not in forbidden_keywords:
                    forbidden_keywords.append(keyword)
            
            scope_creep_detection['forbidden_keywords'] = forbidden_keywords
            updated['scope_creep_detection'] = scope_creep_detection
        
        return updated
    
    def _update_prd_digest(
        self, 
        prd_digest: Dict, 
        plan: InsertionPlan, 
        analysis: FeatureAnalysis
    ) -> Dict:
        """Update prd_digest.json with enhancement information"""
        updated = prd_digest.copy()
        
        # Add to MVP features if there's room (max 7)
        mvp_features = updated.get('mvp_features', [])
        if len(mvp_features) < 7:
            mvp_feature = {
                "id": analysis.feature_id,
                "name": analysis.description[:50] + "..." if len(analysis.description) > 50 else analysis.description,
                "prd_lines": ["ENHANCEMENT"],
                "original_text": analysis.description,
                "why_mvp": f"Enhancement added post-planning - {analysis.complexity} complexity"
            }
            mvp_features.append(mvp_feature)
            updated['mvp_features'] = mvp_features
        
        # Update protection metrics
        protection_metrics = updated.get('protection_metrics', {})
        protection_metrics['enhancements_added'] = protection_metrics.get('enhancements_added', 0) + 1
        protection_metrics['last_enhancement_date'] = datetime.now().isoformat()[:10]
        updated['protection_metrics'] = protection_metrics
        
        return updated
    
    def _update_deferred_features(
        self, 
        deferred: Dict, 
        analysis: FeatureAnalysis
    ) -> Dict:
        """Update deferred.json - remove feature if it's being reactivated"""
        updated = deferred.copy()
        
        # Check if this enhancement matches a deferred feature
        deferred_features = updated.get('deferred_features', [])
        original_count = len(deferred_features)
        
        # Remove any deferred feature that matches this description (simple keyword matching)
        analysis_keywords = set(analysis.description.lower().split())
        filtered_features = []
        
        for feature in deferred_features:
            feature_keywords = set(feature.get('name', '').lower().split())
            # If there's significant overlap, consider it the same feature
            overlap = len(analysis_keywords.intersection(feature_keywords))
            if overlap < 2:  # Require at least 2 matching keywords to consider it the same
                filtered_features.append(feature)
        
        if len(filtered_features) < original_count:
            updated['deferred_features'] = filtered_features
            updated['total_deferred'] = len(filtered_features)
        
        return updated
    
    def _update_techstack_research(
        self, 
        techstack_research: Dict, 
        analysis: FeatureAnalysis
    ) -> Dict:
        """Update techstack_research.json if new technologies were added"""
        updated = techstack_research.copy()
        
        if not analysis.new_technologies:
            return updated
        
        # Add placeholder research for new technologies
        # In a real implementation, this would trigger actual research
        stack = updated.get('stack', {})
        
        for tech in analysis.new_technologies:
            if tech not in stack:
                stack[tech] = {
                    "name": tech,
                    "version": "TBD",
                    "version_verified": {
                        "source": "Enhancement - needs research",
                        "checked_date": datetime.now().isoformat()[:10],
                        "is_latest_stable": False
                    },
                    "documentation": {
                        "official_url": "TBD",
                        "last_updated": "TBD"
                    },
                    "decision_sources": [{
                        "url": "Enhancement request",
                        "published": datetime.now().isoformat()[:10],
                        "relevance": "Required for new feature"
                    }],
                    "needs_verification": True
                }
        
        updated['stack'] = stack
        
        # Update research metadata
        research_metadata = updated.get('research_timestamp', '')
        updated['last_enhancement_research'] = datetime.now().isoformat()[:10]
        
        return updated
    
    def _validate_json_consistency(self) -> None:
        """Validate that all JSON files are consistent after updates"""
        
        # Load all files
        data = self._load_all_json_files()
        
        # Check task_graph consistency
        task_graph = data.get('task_graph', {})
        progress_tracker = data.get('progress_tracker', {})
        
        # Validate task count consistency
        tasks_in_graph = len(task_graph.get('tasks', []))
        tasks_in_progress = progress_tracker.get('total_tasks', 0)
        
        if tasks_in_graph != tasks_in_progress:
            raise ValueError(f"Task count mismatch: graph has {tasks_in_graph}, progress has {tasks_in_progress}")
        
        # Validate milestone consistency
        milestones_in_graph = {m.get('id') for m in task_graph.get('milestones', [])}
        current_milestone_id = progress_tracker.get('current_milestone', {}).get('id')
        
        if current_milestone_id and current_milestone_id not in milestones_in_graph:
            raise ValueError(f"Current milestone {current_milestone_id} not found in milestone list")
        
        # Validate all task IDs are unique
        task_ids = [task.get('id') for task in task_graph.get('tasks', [])]
        if len(task_ids) != len(set(task_ids)):
            duplicates = [tid for tid in task_ids if task_ids.count(tid) > 1]
            raise ValueError(f"Duplicate task IDs found: {duplicates}")
        
        print("✅ JSON consistency validation passed")

def main():
    """Test the JSON updater"""
    import sys
    from dependency_analyzer import DependencyAnalyzer
    from task_inserter import TaskInserter
    
    if len(sys.argv) < 2:
        print("Usage: json_updater.py 'feature description'")
        sys.exit(1)
    
    feature_desc = sys.argv[1]
    
    # Analyze feature
    analyzer = DependencyAnalyzer()
    analysis = analyzer.analyze_feature(feature_desc)
    
    # Find insertion plan
    inserter = TaskInserter()
    options = inserter.find_insertion_options(analysis)
    if not options:
        print("No suitable insertion options found")
        sys.exit(1)
    
    plan = inserter.create_insertion_plan(analysis, options[0])
    
    # Apply updates (dry run)
    updater = JsonUpdater()
    print("This would create backup and update the following files:")
    print(f"- task_graph.json: Add {len(plan.new_tasks)} tasks")
    print(f"- progress_tracker.json: Update totals and milestones")
    print(f"- guardrail_config.json: Add protection rules")
    print(f"- prd_digest.json: Track enhancement")
    print(f"- deferred.json: Remove if reactivating feature")
    print(f"- techstack_research.json: Add {len(analysis.new_technologies)} new technologies")
    
    # Uncomment to actually apply:
    # summary = updater.apply_enhancement(analysis, plan)
    # print(f"Update Summary: {summary}")

if __name__ == "__main__":
    main()