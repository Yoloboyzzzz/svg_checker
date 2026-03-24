import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FixButton } from '../../src/components/FixButton'

describe('FixButton', () => {
  it('is disabled when score is 100', () => {
    render(<FixButton score={100} onFix={vi.fn()} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is enabled when score is less than 100', () => {
    render(<FixButton score={67} onFix={vi.fn()} />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})
