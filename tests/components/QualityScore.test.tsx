import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QualityScore } from '../../src/components/QualityScore'

describe('QualityScore', () => {
  it('renders 100% for perfect score', () => {
    render(<QualityScore score={100} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('renders 0% for zero score', () => {
    render(<QualityScore score={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders 67% for partial score', () => {
    render(<QualityScore score={67} />)
    expect(screen.getByText('67%')).toBeInTheDocument()
  })
})
