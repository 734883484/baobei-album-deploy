import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

function CropperBridge({ aspect, image, initialZoom = 1, minZoom = 0.2, onReady }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const zoomRef = useRef(initialZoom);
  const croppedAreaPixelsRef = useRef(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    onReady({
      getCroppedAreaPixels: () => croppedAreaPixelsRef.current,
      getZoom: () => zoomRef.current,
      setZoom
    });
  }, [onReady]);

  return (
    <Cropper
      aspect={aspect}
      crop={crop}
      cropShape="rect"
      image={image}
      minZoom={minZoom}
      objectFit="contain"
      onCropChange={setCrop}
      onCropComplete={(_area, croppedAreaPixels) => {
        croppedAreaPixelsRef.current = croppedAreaPixels;
      }}
      onZoomChange={setZoom}
      restrictPosition={false}
      showGrid={false}
      zoom={zoom}
    />
  );
}

function mount(container, options) {
  const root = createRoot(container);
  let controller = null;

  root.render(
    <CropperBridge
      aspect={options.aspect}
      image={options.image}
      initialZoom={options.initialZoom}
      minZoom={options.minZoom}
      onReady={(nextController) => {
        controller = nextController;
        options.onReady?.(nextController);
      }}
    />
  );

  return {
    getCroppedAreaPixels: () => controller?.getCroppedAreaPixels() ?? null,
    getZoom: () => controller?.getZoom() ?? options.initialZoom ?? 1,
    setZoom: (zoom) => controller?.setZoom(Number(zoom)),
    unmount: () => root.unmount()
  };
}

window.BaobeiEasyCropper = { mount };
