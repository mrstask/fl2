from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parent.parent
TASKS_DOC = ROOT / "docs" / "rendering_module_tasks.md"


@dataclass(frozen=True)
class StepExpectation:
    step: str
    task_ids: tuple[str, ...]


def load_tasks_doc() -> str:
    if not TASKS_DOC.exists():
        raise AssertionError(f"Missing tasks doc: {TASKS_DOC}")
    return TASKS_DOC.read_text(encoding="utf-8")


def extract_step_block(content: str, step: str) -> str:
    pattern = rf"## Step {step}:(.*?)(?:\n## Step |\n## Final Exit Criteria)"
    match = re.search(pattern, content, flags=re.DOTALL)
    if not match:
        raise AssertionError(f"Could not find step block for step {step}")
    return match.group(1)


def assert_step_tasks(
    testcase: unittest.TestCase,
    expectation: StepExpectation,
) -> None:
    content = load_tasks_doc()
    block = extract_step_block(content, expectation.step)

    for task_id in expectation.task_ids:
        testcase.assertIn(
            f"`{task_id}`",
            block,
            msg=f"Missing task {task_id} in step {expectation.step}",
        )
        testcase.assertRegex(
            block,
            rf"### `{re.escape(task_id)}`[\s\S]*?- Definition of done:",
            msg=f"Missing DoD section for task {task_id}",
        )
        testcase.assertRegex(
            block,
            rf"### `{re.escape(task_id)}`[\s\S]*?- Dependencies:",
            msg=f"Missing dependency section for task {task_id}",
        )


def assert_step_has_three_definition_checks(
    testcase: unittest.TestCase,
    expectation: StepExpectation,
) -> None:
    content = load_tasks_doc()
    block = extract_step_block(content, expectation.step)

    for task_id in expectation.task_ids:
        task_pattern = rf"### `{re.escape(task_id)}`([\s\S]*?)(?:\n### `RND-|\Z)"
        task_match = re.search(task_pattern, block)
        testcase.assertIsNotNone(task_match, msg=f"Missing block for {task_id}")
        task_block = task_match.group(1)

        dod_match = re.search(r"- Definition of done:\n((?:\d+\..*\n){3,})", task_block)
        testcase.assertIsNotNone(
            dod_match, msg=f"Task {task_id} must include at least 3 DoD checks"
        )
