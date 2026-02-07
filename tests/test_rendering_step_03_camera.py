import unittest

from rendering_step_assertions import (
    StepExpectation,
    assert_step_has_three_definition_checks,
    assert_step_tasks,
)


class TestRenderingStep03Camera(unittest.TestCase):
    def test_step_03_has_required_tasks_and_quality_gates(self) -> None:
        expectation = StepExpectation(
            step="3",
            task_ids=("RND-03-01", "RND-03-02", "RND-03-03"),
        )
        assert_step_tasks(self, expectation)
        assert_step_has_three_definition_checks(self, expectation)


if __name__ == "__main__":
    unittest.main()

