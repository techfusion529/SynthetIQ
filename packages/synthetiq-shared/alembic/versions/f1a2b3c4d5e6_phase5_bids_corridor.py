"""phase5_bids_corridor

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-11-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add corridor_min and corridor_max columns to auctions table."""
    op.add_column('auctions', sa.Column('corridor_min', sa.Float(), nullable=True))
    op.add_column('auctions', sa.Column('corridor_max', sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove corridor_min and corridor_max from auctions table."""
    op.drop_column('auctions', 'corridor_max')
    op.drop_column('auctions', 'corridor_min')
