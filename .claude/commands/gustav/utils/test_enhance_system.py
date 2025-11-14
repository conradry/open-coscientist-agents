#!/usr/bin/env python3
"""
Integration test for Gustav Enhancement System

Tests the complete flow from feature analysis to JSON updates.
"""

import sys
import json
from dependency_analyzer import DependencyAnalyzer, FeatureAnalysis
from task_inserter import TaskInserter, InsertionPlan
from json_updater import JsonUpdater
from research_integrator import ResearchIntegrator

def test_enhancement_flow(feature_description: str, dry_run: bool = True):
    """Test the complete enhancement flow"""
    
    print(f"🧪 Testing Enhancement Flow")
    print(f"Feature: {feature_description}")
    print(f"Dry Run: {dry_run}")
    print("=" * 60)
    
    try:
        # Step 1: Analyze feature
        print("1️⃣ Analyzing feature...")
        analyzer = DependencyAnalyzer()
        analysis = analyzer.analyze_feature(feature_description)
        
        print(f"   ✅ Complexity: {analysis.complexity}")
        print(f"   ✅ Estimated Tasks: {analysis.estimated_tasks}")
        print(f"   ✅ New Technologies: {analysis.new_technologies}")
        print(f"   ✅ Dependencies: {len(analysis.dependencies)}")
        print(f"   ✅ Conflicts: {len(analysis.conflicts)}")
        print()
        
        # Step 2: Research analysis
        print("2️⃣ Analyzing research needs...")
        research_integrator = ResearchIntegrator()
        research_needs = research_integrator.analyze_research_needs(analysis.new_technologies)
        
        needs_research = [tech for tech, status in research_needs.items() 
                         if status == 'new_research_required']
        print(f"   ✅ Technologies needing research: {len(needs_research)}")
        
        if needs_research:
            queries = research_integrator.generate_research_queries(
                needs_research, 
                research_integrator.existing_research
            )
            agents = research_integrator.create_research_agents(queries)
            print(f"   ✅ Research agents required: {len(agents)}")
        print()
        
        # Step 3: Find insertion options
        print("3️⃣ Finding insertion options...")
        inserter = TaskInserter()
        options = inserter.find_insertion_options(analysis)
        
        print(f"   ✅ Insertion options found: {len(options)}")
        if options:
            best_option = options[0]
            print(f"   ✅ Best option: {best_option.strategy.value}")
            print(f"   ✅ Target milestone: {best_option.target_milestone_id}")
            print(f"   ✅ Dependencies satisfied: {best_option.dependencies_satisfied}")
            print(f"   ✅ Impact score: {best_option.impact_score}")
        print()
        
        # Step 4: Create insertion plan
        print("4️⃣ Creating insertion plan...")
        if options:
            plan = inserter.create_insertion_plan(analysis, best_option)
            print(f"   ✅ Tasks to create: {len(plan.new_tasks)}")
            print(f"   ✅ Milestones to update: {len(plan.updated_milestones)}")
            print(f"   ✅ Structural changes: {plan.impact_summary.get('structural_changes', False)}")
        else:
            print("   ❌ No insertion options available")
            return False
        print()
        
        # Step 5: JSON updates (dry run or actual)
        print("5️⃣ Preparing JSON updates...")
        updater = JsonUpdater()
        
        if dry_run:
            print("   🔍 DRY RUN - Files that would be updated:")
            print(f"   - task_graph.json: +{len(plan.new_tasks)} tasks")
            print(f"   - progress_tracker.json: totals and milestone updates")
            print(f"   - guardrail_config.json: protection rules")
            print(f"   - prd_digest.json: enhancement tracking")
            if analysis.new_technologies:
                print(f"   - techstack_research.json: +{len(analysis.new_technologies)} technologies")
            if analysis.conflicts:
                print(f"   - deferred.json: potential feature removals")
        else:
            print("   🚀 Applying updates...")
            summary = updater.apply_enhancement(analysis, plan)
            print(f"   ✅ Files updated: {len(summary.files_updated)}")
            print(f"   ✅ Backup location: {summary.backup_location}")
            print(f"   ✅ Tasks added: {len(summary.new_task_ids)}")
            print(f"   ✅ Total tasks: {summary.total_tasks_before} → {summary.total_tasks_after}")
        print()
        
        # Step 6: Validation
        print("6️⃣ System validation...")
        if not dry_run:
            try:
                updater._validate_json_consistency()
                print("   ✅ JSON consistency validation passed")
            except Exception as e:
                print(f"   ❌ Validation failed: {e}")
                return False
        else:
            print("   🔍 Validation skipped (dry run)")
        print()
        
        print("🎉 Enhancement system test completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_multiple_scenarios():
    """Test multiple enhancement scenarios"""
    
    scenarios = [
        "Add keyboard shortcut to pause/resume recording",
        "Add support for multiple Simplicate accounts with account switching",
        "Add text-to-speech responses for confirmation",
        "Add visual feedback with animated system tray icon",
        "Add command line interface for batch time entry import"
    ]
    
    print("🧪 Testing Multiple Enhancement Scenarios")
    print("=" * 60)
    
    results = []
    for i, scenario in enumerate(scenarios, 1):
        print(f"\nScenario {i}: {scenario}")
        print("-" * 40)
        
        success = test_enhancement_flow(scenario, dry_run=True)
        results.append((scenario, success))
        
        if not success:
            print(f"❌ Scenario {i} failed")
            break
        else:
            print(f"✅ Scenario {i} passed")
    
    print(f"\n📊 Results Summary:")
    for scenario, success in results:
        status = "✅" if success else "❌"
        print(f"   {status} {scenario}")
    
    total_passed = sum(1 for _, success in results if success)
    print(f"\n🏆 {total_passed}/{len(scenarios)} scenarios passed")
    
    return total_passed == len(scenarios)

def main():
    """Main test function"""
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  test_enhance_system.py 'feature description'  # Test single feature")
        print("  test_enhance_system.py --all                  # Test multiple scenarios")
        print("  test_enhance_system.py --help                 # Show this help")
        sys.exit(1)
    
    if sys.argv[1] == '--help':
        main()
    elif sys.argv[1] == '--all':
        success = test_multiple_scenarios()
        sys.exit(0 if success else 1)
    else:
        feature_desc = sys.argv[1]
        dry_run = '--apply' not in sys.argv
        success = test_enhancement_flow(feature_desc, dry_run=dry_run)
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()