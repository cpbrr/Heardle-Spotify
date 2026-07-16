interface ResultViewProps {
  outcome: 'won' | 'lost';
  title: string;
  artist: string;
  imageUrl: string | null;
  onPlayFullTrack(): void;
  onPlayAnother(): void;
}

export function ResultView({ outcome, title, artist, imageUrl, onPlayFullTrack, onPlayAnother }: ResultViewProps) {
  return (
    <section className="result-view" aria-label="Round result">
      {imageUrl ? (
        <img className="artwork" src={imageUrl} alt={`${title} album cover`} />
      ) : (
        <div className="artwork artwork-placeholder" aria-hidden="true" />
      )}
      <h2>{outcome === 'won' ? 'You got it!' : 'Better luck next time'}</h2>
      <p>{title} - {artist}</p>
      <button type="button" onClick={onPlayFullTrack}>Play full track</button>
      <button type="button" onClick={onPlayAnother}>Play another</button>
    </section>
  );
}


