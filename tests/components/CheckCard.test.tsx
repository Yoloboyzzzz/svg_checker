import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { CheckCard } from '../../src/components/CheckCard'
import type { CheckResult } from '../../src/types'

const failResult: CheckResult = {
  category: 'groups',
  label: 'No Groups',
  weight: 1/3,
  pass: false,
  violationCount: 2,
  violations: [
    { elementIndex: 0, elementId: 'g1', description: '<g> element id="g1"' },
    { elementIndex: 1, elementId: null, description: '<g> element' },
  ]
}

const passResult: CheckResult = {
  ...failResult,
  pass: true,
  violationCount: 0,
  violations: []
}

describe('CheckCard', () => {
  it('shows pass indicator when passing', () => {
    render(<CheckCard result={passResult} />)
    expect(screen.getByText(/pass/i)).toBeInTheDocument()
  })

  it('shows violation count when failing', () => {
    render(<CheckCard result={failResult} />)
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('expands on click to show violation details', async () => {
    render(<CheckCard result={failResult} />)
    const toggle = screen.getByRole('button')
    await userEvent.click(toggle)
    expect(screen.getAllByText(/g1/).length).toBeGreaterThan(0)
  })
})
