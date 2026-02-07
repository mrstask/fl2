import unittest

from rendering_step_assertions import (
    StepExpectation,
    assert_step_has_three_definition_checks,
    assert_step_tasks,
)


class TestRenderingStep08Picking(unittest.TestCase):
    def test_step_08_has_required_tasks_and_quality_gates(self) -> None:
        expectation = StepExpectation(
            step="8",
            task_ids=("RND-08-01", "RND-08-02", "RND-08-03"),
        )
        assert_step_tasks(self, expectation)
        assert_step_has_three_definition_checks(self, expectation)


if __name__ == "__main__":
    unittest.main()

