import { useEffect, useState } from 'react';

type DownloadPhase = 'extracting' | 'downloading' | 'writing_manifest' | 'done' | 'error';

interface DownloadProgressEvent {
  phase: DownloadPhase;
  message: string;
  foundTotal?: number;
  downloaded?: number;
  totalToDownload?: number;
}

const LABEL_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function phaseLabel(phase: DownloadPhase | null): string {
  return phase ?? 'idle';
}

export default function App(): JSX.Element {
  const [productUrl, setProductUrl] = useState('');
  const [productLabel, setProductLabel] = useState('');
  const [baseDir, setBaseDir] = useState('');
  const [phase, setPhase] = useState<DownloadPhase | null>(null);
  const [message, setMessage] = useState('Ready');
  const [foundTotal, setFoundTotal] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState<number | null>(null);
  const [totalToDownload, setTotalToDownload] = useState<number | null>(null);
  const [lastError, setLastError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);
  const [lastFolderPath, setLastFolderPath] = useState('');

  useEffect(() => {
    const unsubscribe = window.aliImagePull.onDownloadProgress((event: DownloadProgressEvent) => {
      setPhase(event.phase);
      setMessage(event.message);
      setFoundTotal(event.foundTotal ?? null);
      setDownloaded(event.downloaded ?? null);
      setTotalToDownload(event.totalToDownload ?? null);

      if (event.phase === 'error') {
        setLastError(event.message);
      }
    });

    return unsubscribe;
  }, []);

  const labelError =
    productLabel.length > 0 && !LABEL_PATTERN.test(productLabel)
      ? 'Use only A-Z, a-z, 0-9, _, - (max 64 chars).'
      : '';

  async function onPickDirectory(): Promise<void> {
    const chosen = await window.aliImagePull.selectDirectory();
    if (chosen) {
      setBaseDir(chosen);
    }
  }

  async function onDownload(): Promise<void> {
    setLastError('');

    if (!productUrl.trim()) {
      setLastError('Product URL is required.');
      return;
    }

    if (!productLabel.trim()) {
      setLastError('Product Label is required.');
      return;
    }

    if (labelError) {
      setLastError(labelError);
      return;
    }

    if (!baseDir.trim()) {
      setLastError('Base Download Directory is required.');
      return;
    }

    setIsDownloading(true);
    setPhase('extracting');
    setMessage('Starting extraction...');

    try {
      const result = await window.aliImagePull.downloadImages({
        url: productUrl.trim(),
        label: productLabel.trim(),
        baseDir: baseDir.trim()
      });
      setLastFolderPath(result.folderPath);
      setPhase('done');
      setMessage(`Saved ${result.imageCount} unique images.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setLastError(text);
      setPhase('error');
      setMessage(text);
    } finally {
      setIsDownloading(false);
    }
  }

  async function onGenerateLabel(): Promise<void> {
    setLastError('');
    if (!productUrl.trim()) {
      setLastError('Enter Product URL before generating a label.');
      return;
    }

    setIsGeneratingLabel(true);
    try {
      const generated = await window.aliImagePull.suggestLabel(productUrl.trim());
      setProductLabel(generated);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setLastError(text);
    } finally {
      setIsGeneratingLabel(false);
    }
  }

  async function onOpenFolder(): Promise<void> {
    if (!lastFolderPath) {
      return;
    }
    await window.aliImagePull.openFolder(lastFolderPath);
  }

  return (
    <main className="shell">
      <section className="panel">
        <header className="header">
          <p className="eyebrow">AliExpress Image Pipeline</p>
          <h1>AliImagePull</h1>
        </header>

        <label className="field">
          <span>Product URL</span>
          <input
            value={productUrl}
            onChange={(event) => setProductUrl(event.target.value)}
            placeholder="https://www.aliexpress.com/item/..."
            type="url"
          />
        </label>

        <div className="field">
          <span>Product Label</span>
          <div className="row">
            <input
              value={productLabel}
              onChange={(event) => setProductLabel(event.target.value.slice(0, 64))}
              placeholder="example_001"
            />
            <button type="button" className="ghost" onClick={onGenerateLabel} disabled={isGeneratingLabel}>
              {isGeneratingLabel ? 'Generating...' : 'Generate from URL'}
            </button>
          </div>
        </div>
        {labelError ? <p className="hint error">{labelError}</p> : null}

        <div className="field">
          <span>Base Download Directory</span>
          <div className="row">
            <input value={baseDir} readOnly placeholder="Choose a local folder" />
            <button type="button" className="ghost" onClick={onPickDirectory}>
              Browse
            </button>
          </div>
        </div>

        <div className="actions">
          <button type="button" className="primary" onClick={onDownload} disabled={isDownloading}>
            {isDownloading ? 'Downloading...' : 'Download Images'}
          </button>
          <button type="button" className="ghost" onClick={onOpenFolder} disabled={!lastFolderPath}>
            Open Folder
          </button>
        </div>

        <div className="status">
          <p>
            <strong>phase:</strong> {phaseLabel(phase)}
          </p>
          <p>
            <strong>progress:</strong> found {foundTotal ?? 0}, downloaded {downloaded ?? 0}/
            {totalToDownload ?? 0}
          </p>
          <p>
            <strong>message:</strong> {message}
          </p>
          {lastError ? (
            <p className="error">
              <strong>last error:</strong> {lastError}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
