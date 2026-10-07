"""The one registered real host lifecycle acceptance body.

Default collection always skips this body. Admission additionally requires the
exact sequencer environment, pytest --run-lifecycle, marker, and fixture.
"""

import pytest

from lifecycle.live import run_live_acceptance


@pytest.mark.lifecycle
@pytest.mark.macos_host
def test_destroy_only_generated_target(lifecycle_scope):
    summary = run_live_acceptance(lifecycle_scope)
    assert summary.is_file()
