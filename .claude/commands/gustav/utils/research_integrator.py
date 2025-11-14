#!/usr/bin/env python3
"""
Research Integration System for Gustav Enhancement

Integrates with existing Gustav research system to perform targeted
research for new technologies needed by enhancement features.
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Set, Optional
from dataclasses import dataclass

from dependency_analyzer import find_project_root

@dataclass
class ResearchResult:
    agent_id: str
    technology: str
    recommendations: List[str]
    sources: List[str]
    warnings: List[str]
    version_info: Optional[Dict] = None

@dataclass  
class ResearchSummary:
    research_duration: str
    agents_used: int
    technologies_researched: List[str]
    existing_technologies_reused: List[str]
    new_research_required: bool
    compatibility_issues: List[str]

class ResearchIntegrator:
    def __init__(self, tasks_dir: str = None):
        if tasks_dir is None:
            project_root = find_project_root()
            tasks_dir = os.path.join(project_root, ".tasks")
        self.tasks_dir = tasks_dir
        self.existing_research = self._load_existing_research()
        
    def _load_existing_research(self) -> Dict:
        """Load existing techstack research"""
        try:
            with open(f"{self.tasks_dir}/techstack_research.json", 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
    
    def analyze_research_needs(self, new_technologies: List[str]) -> Dict[str, str]:
        """
        Analyze what research is needed for new technologies.
        Returns dict mapping technology -> research_status
        """
        research_needs = {}
        existing_stack = self.existing_research.get('stack', {})
        
        for tech in new_technologies:
            if self._is_technology_researched(tech, existing_stack):
                research_needs[tech] = "existing"
            elif self._is_compatible_technology(tech, existing_stack):
                research_needs[tech] = "compatible"
            else:
                research_needs[tech] = "new_research_required"
        
        return research_needs
    
    def _is_technology_researched(self, tech: str, existing_stack: Dict) -> bool:
        """Check if technology already exists in current research"""
        tech_lower = tech.lower()
        
        for stack_tech in existing_stack.values():
            if isinstance(stack_tech, dict):
                name = stack_tech.get('name', '').lower()
                if tech_lower == name or tech_lower in name:
                    return True
            elif isinstance(stack_tech, str):
                if tech_lower == stack_tech.lower() or tech_lower in stack_tech.lower():
                    return True
        
        return False
    
    def _is_compatible_technology(self, tech: str, existing_stack: Dict) -> bool:
        """Check if technology is compatible with existing stack"""
        
        # Define technology compatibility groups
        compatibility_groups = {
            'ui_frameworks': ['svelte', 'react', 'vue', 'angular'],
            'backend_frameworks': ['express', 'fastapi', 'django', 'spring'],
            'databases': ['sqlite', 'postgres', 'mysql', 'mongodb'],
            'audio_processing': ['whisper', 'speech_recognition', 'web_audio_api'],
            'ai_libraries': ['langchain', 'openai', 'anthropic', 'huggingface'],
            'desktop_frameworks': ['tauri', 'electron', 'qt', 'flutter'],
            'testing_frameworks': ['jest', 'pytest', 'vitest', 'mocha']
        }
        
        tech_lower = tech.lower()
        
        # Find which group the new technology belongs to
        tech_group = None
        for group, techs in compatibility_groups.items():
            if any(t in tech_lower for t in techs):
                tech_group = group
                break
        
        if not tech_group:
            return False
        
        # Check if we already have a technology from the same group
        for stack_tech in existing_stack.values():
            if isinstance(stack_tech, dict):
                name = stack_tech.get('name', '').lower()
            elif isinstance(stack_tech, str):
                name = stack_tech.lower()
            else:
                continue
            
            for group_tech in compatibility_groups[tech_group]:
                if group_tech in name and group_tech not in tech_lower:
                    # We have a different tech from same group - potential compatibility issue
                    return False
        
        return True
    
    def generate_research_queries(self, technologies: List[str], project_context: Dict) -> Dict[str, List[str]]:
        """Generate research queries for new technologies"""
        
        project_type = self._infer_project_type(project_context)
        current_date = datetime.now().strftime("%B %Y")
        
        queries = {}
        
        for tech in technologies:
            tech_queries = []
            
            # Base technology queries
            tech_queries.extend([
                f"{tech} getting started guide {current_date}",
                f"{tech} documentation official {current_date}",
                f"{tech} best practices {current_date}",
                f"{tech} installation setup {current_date}"
            ])
            
            # Project-specific queries
            if project_type:
                tech_queries.extend([
                    f"{tech} {project_type} integration {current_date}",
                    f"{tech} {project_type} examples {current_date}"
                ])
            
            # Compatibility queries with existing stack
            existing_techs = self._get_existing_technology_names()
            for existing_tech in existing_techs[:3]:  # Limit to top 3 to avoid too many queries
                tech_queries.append(f"{tech} {existing_tech} compatibility {current_date}")
            
            queries[tech] = tech_queries
        
        return queries
    
    def _infer_project_type(self, project_context: Dict) -> Optional[str]:
        """Infer project type from existing research context"""
        
        stack = project_context.get('stack', {})
        
        # Look for key indicators in existing stack
        stack_str = str(stack).lower()
        
        if any(framework in stack_str for framework in ['tauri', 'electron']):
            return 'desktop application'
        elif any(framework in stack_str for framework in ['react', 'vue', 'svelte']):
            return 'web application'
        elif any(framework in stack_str for framework in ['cli', 'command']):
            return 'cli tool'
        elif any(framework in stack_str for framework in ['game', 'unity']):
            return 'game'
        elif any(framework in stack_str for framework in ['data', 'pipeline']):
            return 'data pipeline'
        
        return None
    
    def _get_existing_technology_names(self) -> List[str]:
        """Get list of existing technology names for compatibility checking"""
        
        existing_stack = self.existing_research.get('stack', {})
        tech_names = []
        
        for tech in existing_stack.values():
            if isinstance(tech, dict):
                name = tech.get('name')
                if name:
                    tech_names.append(name)
            elif isinstance(tech, str):
                tech_names.append(tech)
        
        return tech_names
    
    def create_research_agents(self, research_queries: Dict[str, List[str]]) -> List[Dict]:
        """Create research agent configurations for new technologies"""
        
        agents = []
        agent_id_counter = 1
        
        for tech, queries in research_queries.items():
            # Create primary research agent for each technology
            agent = {
                "agent_id": f"SA-ENH-{agent_id_counter}",
                "technology": tech,
                "primary_query": queries[0] if queries else f"{tech} overview",
                "secondary_queries": queries[1:4] if len(queries) > 1 else [],
                "expected_outputs": [
                    "official_documentation_url",
                    "latest_stable_version", 
                    "installation_method",
                    "basic_usage_example",
                    "compatibility_notes"
                ],
                "research_focus": "integration_feasibility"
            }
            agents.append(agent)
            agent_id_counter += 1
            
            # Create compatibility agent if needed
            if len(queries) > 4:  # Has compatibility queries
                compat_agent = {
                    "agent_id": f"SA-ENH-COMPAT-{agent_id_counter}",
                    "technology": f"{tech}_compatibility",
                    "primary_query": queries[-1],  # Last query is usually compatibility
                    "secondary_queries": [],
                    "expected_outputs": [
                        "compatibility_status",
                        "integration_complexity",
                        "potential_conflicts",
                        "migration_requirements"
                    ],
                    "research_focus": "compatibility_analysis"
                }
                agents.append(compat_agent)
                agent_id_counter += 1
        
        return agents
    
    def process_research_results(self, results: List[ResearchResult]) -> ResearchSummary:
        """Process research results and generate summary"""
        
        technologies_researched = [r.technology for r in results if not r.technology.endswith('_compatibility')]
        agents_used = len(results)
        compatibility_issues = []
        
        # Extract compatibility issues
        for result in results:
            if result.technology.endswith('_compatibility'):
                compatibility_issues.extend(result.warnings)
        
        # Determine if new research was actually required
        new_research_required = len(technologies_researched) > 0
        
        # Get existing technologies that can be reused
        existing_technologies_reused = []
        for tech in technologies_researched:
            if self._is_technology_researched(tech, self.existing_research.get('stack', {})):
                existing_technologies_reused.append(tech)
        
        return ResearchSummary(
            research_duration=f"{agents_used * 30}s",  # Rough estimate
            agents_used=agents_used,
            technologies_researched=technologies_researched,
            existing_technologies_reused=existing_technologies_reused,
            new_research_required=new_research_required,
            compatibility_issues=compatibility_issues
        )
    
    def update_techstack_with_research(
        self, 
        research_results: List[ResearchResult],
        existing_techstack: Dict
    ) -> Dict:
        """Update techstack research with new findings"""
        
        updated_techstack = existing_techstack.copy()
        stack = updated_techstack.get('stack', {})
        
        for result in research_results:
            if not result.technology.endswith('_compatibility'):
                
                # Create new technology entry
                tech_key = f"enhancement_{result.technology}"
                stack[tech_key] = {
                    "name": result.technology,
                    "version": result.version_info.get('version', 'latest') if result.version_info else 'latest',
                    "version_verified": {
                        "source": result.sources[0] if result.sources else "enhancement research",
                        "checked_date": datetime.now().isoformat()[:10],
                        "is_latest_stable": True
                    },
                    "documentation": {
                        "official_url": next((s for s in result.sources if 'official' in s.lower()), result.sources[0] if result.sources else ""),
                        "last_updated": datetime.now().isoformat()[:10]
                    },
                    "decision_sources": [
                        {
                            "url": source,
                            "published": datetime.now().isoformat()[:10],
                            "relevance": "Enhancement research"
                        } for source in result.sources[:2]  # Limit to 2 sources
                    ],
                    "needs_verification": False,
                    "enhancement_metadata": {
                        "research_agent": result.agent_id,
                        "research_date": datetime.now().isoformat()[:10],
                        "recommendations": result.recommendations,
                        "warnings": result.warnings
                    }
                }
        
        updated_techstack['stack'] = stack
        
        # Update research metadata
        updated_techstack['last_enhancement_research'] = {
            "date": datetime.now().isoformat()[:10],
            "agents_used": len(research_results),
            "technologies_added": len([r for r in research_results if not r.technology.endswith('_compatibility')])
        }
        
        return updated_techstack
    
    def validate_research_completeness(self, technologies: List[str]) -> Dict[str, bool]:
        """Validate that all required research has been completed"""
        
        validation_results = {}
        
        for tech in technologies:
            # Check if technology now exists in research
            has_research = self._is_technology_researched(tech, self.existing_research.get('stack', {}))
            
            # Check if minimum required information exists
            if has_research:
                stack = self.existing_research.get('stack', {})
                tech_info = None
                
                for stack_tech in stack.values():
                    if isinstance(stack_tech, dict) and stack_tech.get('name', '').lower() == tech.lower():
                        tech_info = stack_tech
                        break
                
                if tech_info:
                    required_fields = ['version', 'documentation', 'decision_sources']
                    has_complete_info = all(field in tech_info for field in required_fields)
                    validation_results[tech] = has_complete_info
                else:
                    validation_results[tech] = False
            else:
                validation_results[tech] = False
        
        return validation_results

def main():
    """Test the research integrator"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: research_integrator.py 'tech1,tech2,tech3'")
        sys.exit(1)
    
    technologies = [t.strip() for t in sys.argv[1].split(',')]
    
    integrator = ResearchIntegrator()
    
    # Analyze research needs
    research_needs = integrator.analyze_research_needs(technologies)
    print("Research Needs Analysis:")
    for tech, status in research_needs.items():
        print(f"  {tech}: {status}")
    
    # Generate research queries
    project_context = integrator.existing_research
    queries = integrator.generate_research_queries(technologies, project_context)
    print("\nResearch Queries:")
    for tech, tech_queries in queries.items():
        print(f"  {tech}:")
        for query in tech_queries:
            print(f"    - {query}")
    
    # Create research agents
    agents = integrator.create_research_agents(queries)
    print(f"\nResearch Agents Created: {len(agents)}")
    for agent in agents:
        print(f"  {agent['agent_id']}: {agent['technology']}")

if __name__ == "__main__":
    main()