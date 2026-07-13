import { useEffect, useRef, useState } from "react";
import "./AsyncImage.css";

type AsyncImageProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  src: string;
};

export function AsyncImage({
  alt = "",
  className = "",
  imageClassName = "",
  src,
}: AsyncImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  useEffect(() => {
    const image = imageRef.current;

    if (image?.complete) {
      setStatus(image.naturalWidth > 0 ? "loaded" : "error");
      return;
    }

    setStatus("loading");
  }, [src]);

  return (
    <span className={`async-image async-image--${status} ${className}`.trim()}>
      <img
        alt={alt}
        className={imageClassName}
        crossOrigin="use-credentials"
        onError={() => setStatus("error")}
        onLoad={() => setStatus("loaded")}
        ref={imageRef}
        src={src}
      />
      {status === "error" ? (
        <span aria-hidden="true" className="async-image-error">
          —
        </span>
      ) : null}
    </span>
  );
}
