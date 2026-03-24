import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DropZone } from '../../src/components/DropZone'

describe('DropZone', () => {
  it('renders upload area', () => {
    render(<DropZone onFile={vi.fn()} onError={vi.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onError for non-SVG file', async () => {
    const onError = vi.fn()
    render(<DropZone onFile={vi.fn()} onError={onError} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'image.png', { type: 'image/png' })
    await userEvent.upload(input, file)
    expect(onError).toHaveBeenCalled()
  })
})
