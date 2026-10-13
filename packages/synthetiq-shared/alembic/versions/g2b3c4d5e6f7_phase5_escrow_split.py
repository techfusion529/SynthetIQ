"""phase5_escrow_split

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-11-01 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add advance_amount, holdback_amount, escrow_status to escrow_pos table."""
    op.add_column('escrow_pos', sa.Column('advance_amount', sa.Float(), nullable=True))
    op.add_column('escrow_pos', sa.Column('holdback_amount', sa.Float(), nullable=True))
    op.add_column(
        'escrow_pos',
        sa.Column(
            'escrow_status',
            sa.String(32),
            nullable=True,
            server_default='advance_pending',
        ),
    )


def downgrade() -> None:
    """Remove advance_amount, holdback_amount, escrow_status from escrow_pos table."""
    op.drop_column('escrow_pos', 'escrow_status')
    op.drop_column('escrow_pos', 'holdback_amount')
    op.drop_column('escrow_pos', 'advance_amount')
