type JsonLdProps = {
  data: unknown;
};

export default function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;

  try {
    const json = JSON.stringify(data);

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: json }}
      />
    );
  } catch (err) {
    // If serialization fails, don't render malformed JSON-LD.
    return null;
  }
}
