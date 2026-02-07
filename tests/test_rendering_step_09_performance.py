import unittest

from rendering_step_assertions import (
    StepExpectation,
    assert_step_has_three_definition_checks,
    assert_step_tasks,
)


class TestRenderingStep09Performance(unittest.TestCase):
    def test_step_09_has_required_tasks_and_quality_gates(self) -> None:
        expectation = StepExpectation(
            step="9",
            task_ids=("RND-09-01", "RND-09-02", "RND-09-03"),
        )
        assert_step_tasks(self, expectation)
        assert_step_has_three_definition_checks(self, expectation)


if __name__ == "__main__":
    unittest.main()

