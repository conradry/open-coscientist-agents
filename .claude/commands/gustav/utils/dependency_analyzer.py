#!/usr/bin/env python3
"""
Dependency Analysis Logic for Gustav Enhancement System

Analyzes feature dependencies and determines optimal insertion points
in existing sprint milestone structures.
"""

import json
import os
import re
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
from enum import Enum

class DependencyType(Enum):
    TECHNICAL = "technical"  # Code/API dependencies
    LOGICAL = "logical"      # User workflow dependencies  
    DATA = "data"           # Data/state dependencies

@dataclass
class TaskDependency:
    task_id: str
    dependency_type: DependencyType
    reason: str
    strength: str  # "required" | "preferred" | "optional"

@dataclass
class FeatureAnalysis:
    feature_id: str
    description: str
    estimated_tasks: int
    complexity: str  # "low" | "medium" | "high"
    new_technologies: List[str]
    dependencies: List[TaskDependency]
    conflicts: List[str]
    
def find_project_root(start_dir: str = None) -> str:
    """Find project root by looking for Gustav-specific markers, then .git directory
    
    Args:
        start_dir: Directory to start search from. Defaults to current working directory.
        
    Returns:
        Absolute path to project root directory.
        
    Raises:
        ValueError: If no Gustav project markers are found.
    """
    if start_dir is None:
        start_dir = os.getcwd()
    
    current = os.path.abspath(start_dir)
    original_start = current
    
    while current != os.path.dirname(current):  # Not at filesystem root
        # Priority 1: Look for Gustav-specific markers (.tasks with required files)
        tasks_dir = os.path.join(current, '.tasks')
        if (os.path.exists(tasks_dir) and 
            os.path.exists(os.path.join(tasks_dir, 'task_graph.json'))):
            return current
        
        # Priority 2: Look for .git directory (likely a project root)
        if os.path.exists(os.path.join(current, '.git')):
            # Check if this git project also has Gustav files
            tasks_dir = os.path.join(current, '.tasks')
            if os.path.exists(tasks_dir):
                return current
            # If no .tasks, continue searching - this might be a parent repo
        
        # Priority 3: Look for .claude directory with gustav commands (legacy)
        claude_dir = os.path.join(current, '.claude', 'commands', 'gustav')
        if os.path.exists(claude_dir):
            # Only return if this also looks like a project root
            if (os.path.exists(os.path.join(current, '.git')) or 
                os.path.exists(os.path.join(current, '.tasks'))):
                return current
        
        current = os.path.dirname(current)
    
    # No Gustav project found - provide helpful error
    raise ValueError(
        f"No Gustav project found starting from '{original_start}'. "
        f"Looking for directory containing '.tasks/task_graph.json'. "
        f"Make sure you're running from within a Gustav project directory."
    )

class DependencyAnalyzer:
    def __init__(self, tasks_dir: str = None):
        if tasks_dir is None:
            project_root = find_project_root()
            tasks_dir = os.path.join(project_root, ".tasks")
        self.tasks_dir = tasks_dir
        self.task_graph = self._load_json("task_graph.json")
        self.progress_tracker = self._load_json("progress_tracker.json") 
        self.techstack = self._load_json("techstack_research.json")
        self.deferred = self._load_json("deferred.json")
        
    def _load_json(self, filename: str) -> Dict:
        """Load JSON file from tasks directory"""
        try:
            with open(f"{self.tasks_dir}/{filename}", 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
    
    def analyze_feature(self, feature_description: str) -> FeatureAnalysis:
        """
        Analyze a new feature description and determine its characteristics
        and dependencies on existing tasks.
        """
        # Extract technical keywords from description
        tech_keywords = self._extract_technical_keywords(feature_description)
        
        # Check against existing techstack
        new_technologies = self._identify_new_technologies(tech_keywords)
        
        # Analyze dependencies on existing tasks
        dependencies = self._analyze_dependencies(feature_description, tech_keywords)
        
        # Detect potential conflicts
        conflicts = self._detect_conflicts(feature_description, dependencies)
        
        # Estimate complexity and task count
        complexity, task_count = self._estimate_complexity(
            feature_description, new_technologies, dependencies
        )
        
        return FeatureAnalysis(
            feature_id=f"F-ENH-{len(self.task_graph.get('tasks', []))+1:03d}",
            description=feature_description,
            estimated_tasks=task_count,
            complexity=complexity,
            new_technologies=new_technologies,
            dependencies=dependencies,
            conflicts=conflicts
        )
    
    def _extract_technical_keywords(self, description: str) -> Set[str]:
        """Extract technical keywords from feature description"""
        # Common technical terms that might indicate dependencies
        tech_patterns = {
            r'\bapi\b': 'api',
            r'\bdatabase\b': 'database',
            r'\bauth\w*': 'authentication',
            r'\bui\b|\buser interface\b': 'ui',
            r'\baudio\b|\bvoice\b|\bsound\b': 'audio',
            r'\bhotkey\b|\bshortcut\b|\bkeyboard\b': 'hotkey',
            r'\btray\b|\bsystem tray\b': 'system_tray',
            r'\bconfig\w*|\bsettings\b': 'configuration',
            r'\bfile\b|\bstorage\b': 'file_system',
            r'\bnetwork\b|\bhttp\b|\brequest\b': 'networking',
            r'\bai\b|\bllm\b|\bmachine learning\b': 'ai',
            r'\bparse\w*|\bprocess\w*': 'processing',
        }
        
        keywords = set()
        description_lower = description.lower()
        
        for pattern, keyword in tech_patterns.items():
            if re.search(pattern, description_lower):
                keywords.add(keyword)
                
        return keywords
    
    def _identify_new_technologies(self, tech_keywords: Set[str]) -> List[str]:
        """Identify if feature requires technologies not in current stack"""
        current_stack = set()
        
        # Extract technologies from existing stack
        stack_info = self.techstack.get('stack', {})
        if isinstance(stack_info, dict):
            for tech in stack_info.values():
                if isinstance(tech, dict):
                    current_stack.add(tech.get('name', '').lower())
                elif isinstance(tech, str):
                    current_stack.add(tech.lower())
        
        # Check which keywords represent new technologies
        new_techs = []
        tech_mappings = {
            'database': ['sqlite', 'postgres', 'mysql'],
            'ui': ['svelte', 'react', 'vue'],
            'networking': ['axios', 'fetch', 'requests'],
            'ai': ['langchain', 'openai', 'anthropic'],
        }
        
        for keyword in tech_keywords:
            if keyword in tech_mappings:
                # Check if any of the related technologies are in current stack
                related_techs = tech_mappings[keyword]
                if not any(tech in str(current_stack).lower() for tech in related_techs):
                    new_techs.append(keyword)
            elif keyword not in str(current_stack).lower():
                new_techs.append(keyword)
        
        return new_techs
    
    def _analyze_dependencies(self, description: str, tech_keywords: Set[str]) -> List[TaskDependency]:
        """Analyze dependencies on existing tasks based on feature description"""
        dependencies = []
        existing_tasks = self.task_graph.get('tasks', [])
        
        # Dependency rules based on technical requirements
        dependency_rules = {
            'api': self._find_api_dependencies,
            'audio': self._find_audio_dependencies,
            'hotkey': self._find_hotkey_dependencies,
            'system_tray': self._find_tray_dependencies,
            'authentication': self._find_auth_dependencies,
            'ui': self._find_ui_dependencies,
            'ai': self._find_ai_dependencies,
            'configuration': self._find_config_dependencies,
        }
        
        for keyword in tech_keywords:
            if keyword in dependency_rules:
                rule_deps = dependency_rules[keyword](existing_tasks, description)
                dependencies.extend(rule_deps)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_deps = []
        for dep in dependencies:
            if dep.task_id not in seen:
                seen.add(dep.task_id)
                unique_deps.append(dep)
        
        return unique_deps
    
    def _find_api_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find API-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            # Look for API authentication tasks
            if 'api' in task_title and 'auth' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="API authentication required for API operations",
                    strength="required"
                ))
            
            # Look for API client tasks
            elif 'api' in task_title and 'client' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="API client infrastructure needed",
                    strength="preferred"
                ))
        
        return deps
    
    def _find_audio_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find audio/voice-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            # Audio capture dependencies
            if 'whisper' in task_title or 'audio' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="Audio processing infrastructure required",
                    strength="required"
                ))
                
            # Voice pipeline dependencies
            elif 'voice' in task_title and 'pipeline' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.LOGICAL,
                    reason="Voice processing pipeline needed for audio features",
                    strength="required"
                ))
        
        return deps
    
    def _find_hotkey_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find hotkey/shortcut-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            if 'hotkey' in task_title or 'shortcut' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="Global hotkey system required for shortcuts",
                    strength="required"
                ))
        
        return deps
    
    def _find_tray_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find system tray-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            if 'tray' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="System tray infrastructure required",
                    strength="required"
                ))
        
        return deps
    
    def _find_auth_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find authentication-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            if 'auth' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="Authentication system required",
                    strength="required"
                ))
        
        return deps
    
    def _find_ui_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find UI-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            # Basic app setup usually required for UI features
            if 'setup' in task_title or 'initialize' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="Application setup required for UI components",
                    strength="required"
                ))
        
        return deps
    
    def _find_ai_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find AI/LLM-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            if 'langchain' in task_title or 'llm' in task_title or 'ai' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.TECHNICAL,
                    reason="AI/LLM infrastructure required",
                    strength="required"
                ))
        
        return deps
    
    def _find_config_dependencies(self, existing_tasks: List[Dict], description: str) -> List[TaskDependency]:
        """Find configuration-related dependencies"""
        deps = []
        for task in existing_tasks:
            task_id = task.get('id', '')
            task_title = task.get('title', '').lower()
            
            # Usually configuration depends on basic setup
            if 'setup' in task_title or 'initialize' in task_title:
                deps.append(TaskDependency(
                    task_id=task_id,
                    dependency_type=DependencyType.LOGICAL,
                    reason="Basic setup required before configuration",
                    strength="preferred"
                ))
        
        return deps
    
    def _detect_conflicts(self, description: str, dependencies: List[TaskDependency]) -> List[str]:
        """Detect potential conflicts with existing features"""
        conflicts = []
        
        # Check against deferred features for potential duplication
        deferred_features = self.deferred.get('deferred_features', [])
        description_lower = description.lower()
        
        for deferred in deferred_features:
            deferred_name = deferred.get('name', '').lower()
            # Simple keyword matching for conflict detection
            if any(word in description_lower for word in deferred_name.split()):
                conflicts.append(f"Similar to deferred feature: {deferred.get('name')}")
        
        return conflicts
    
    def _estimate_complexity(
        self, 
        description: str, 
        new_technologies: List[str], 
        dependencies: List[TaskDependency]
    ) -> Tuple[str, int]:
        """Estimate feature complexity and number of tasks needed"""
        
        # Base complexity factors
        complexity_score = 0
        
        # Description length and complexity keywords
        word_count = len(description.split())
        if word_count > 20:
            complexity_score += 2
        elif word_count > 10:
            complexity_score += 1
            
        # Complexity keywords
        complex_keywords = [
            'integration', 'synchronization', 'multiple', 'advanced', 
            'complex', 'algorithm', 'optimization', 'real-time'
        ]
        description_lower = description.lower()
        for keyword in complex_keywords:
            if keyword in description_lower:
                complexity_score += 1
        
        # New technologies add complexity
        complexity_score += len(new_technologies)
        
        # Dependencies add complexity
        required_deps = [d for d in dependencies if d.strength == "required"]
        complexity_score += len(required_deps) // 2
        
        # Determine complexity level and task count
        if complexity_score <= 2:
            return "low", 1
        elif complexity_score <= 5:
            return "medium", 2
        else:
            return "high", 3

def main():
    """Test the dependency analyzer"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: dependency_analyzer.py 'feature description'")
        sys.exit(1)
    
    feature_desc = sys.argv[1]
    analyzer = DependencyAnalyzer()
    analysis = analyzer.analyze_feature(feature_desc)
    
    print(f"Feature Analysis for: {analysis.description}")
    print(f"Complexity: {analysis.complexity}")
    print(f"Estimated Tasks: {analysis.estimated_tasks}")
    print(f"New Technologies: {analysis.new_technologies}")
    print(f"Dependencies:")
    for dep in analysis.dependencies:
        print(f"  - {dep.task_id}: {dep.reason} ({dep.strength})")
    print(f"Potential Conflicts: {analysis.conflicts}")

if __name__ == "__main__":
    main()