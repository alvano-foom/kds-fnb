import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NetworkPrinterError, checkNetworkBridge, isLikelyValidHost, printViaNetwork, testNetworkConnection } from './networkPrinter'

describe('isLikelyValidHost', () => {
  it('accepts a bare IP or hostname', () => {
    expect(isLikelyValidHost('192.168.1.50')).toBe(true)
    expect(isLikelyValidHost('kds-bridge.local')).toBe(true)
  })

  it('rejects blank, whitespace, or a value that already has a scheme on it', () => {
    expect(isLikelyValidHost('')).toBe(false)
    expect(isLikelyValidHost('   ')).toBe(false)
    expect(isLikelyValidHost(null)).toBe(false)
    expect(isLikelyValidHost(undefined)).toBe(false)
    expect(isLikelyValidHost('192.168.1.50 ')).toBe(true) // trimmed internally, but no internal whitespace
    expect(isLikelyValidHost('192.168 1.50')).toBe(false)
    expect(isLikelyValidHost('http://192.168.1.50')).toBe(false)
  })
})

describe('printViaNetwork / checkNetworkBridge / testNetworkConnection', () => {
  const card = { id: 'l1', order_name: 'SO0231', product_name: 'Fried Rice', qty: 2 }

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    delete global.fetch
  })

  it('rejects without making a request when no host is configured', async () => {
    await expect(printViaNetwork({ host: '' }, card)).rejects.toThrow(NetworkPrinterError)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('POSTs raw ESC/POS bytes to http://<host>:<port>/print by default', async () => {
    global.fetch.mockResolvedValue({ ok: true })

    await printViaNetwork({ host: '192.168.1.50', port: '8008' }, card)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('http://192.168.1.50:8008/print')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(Uint8Array)
    expect(options.headers['Content-Type']).toBe('application/octet-stream')
  })

  it('uses https when secure is set', async () => {
    global.fetch.mockResolvedValue({ ok: true })
    await printViaNetwork({ host: '192.168.1.50', port: '8008', secure: true }, card)
    expect(global.fetch.mock.calls[0][0]).toBe('https://192.168.1.50:8008/print')
  })

  it('surfaces a clear error (mentioning https/mixed content) when the request fails outright', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(printViaNetwork({ host: '192.168.1.50', port: '8008' }, card)).rejects.toMatchObject({
      code: 'unreachable',
    })
  })

  it('surfaces a non-2xx bridge response as an http_error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' })

    await expect(printViaNetwork({ host: '192.168.1.50', port: '8008' }, card)).rejects.toMatchObject({
      code: 'http_error',
    })
  })

  it('checkNetworkBridge hits GET /status and never sends print bytes', async () => {
    global.fetch.mockResolvedValue({ ok: true })

    await checkNetworkBridge({ host: '192.168.1.50', port: '8008' })

    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('http://192.168.1.50:8008/status')
    expect(options.method).toBe('GET')
  })

  it('testNetworkConnection sends a real print request with the shared TEST_CARD', async () => {
    global.fetch.mockResolvedValue({ ok: true })

    await testNetworkConnection({ host: '192.168.1.50', port: '8008' })

    const [url] = global.fetch.mock.calls[0]
    expect(url).toBe('http://192.168.1.50:8008/print')
  })
})
