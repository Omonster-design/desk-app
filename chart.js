/** Canvas candle stub for Coin screen. */
window.DeskChart = {
  draw(canvas, points) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!points || points.length < 2) {
      ctx.fillStyle = "#8a8a8a";
      ctx.fillText("No candles yet", 12, 24);
      return;
    }
    const vals = points.map((p) => Number(p.price_usd || p));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    ctx.strokeStyle = "#64d2ff";
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * (canvas.clientWidth - 8) + 4;
      const y = canvas.clientHeight - ((v - min) / span) * (canvas.clientHeight - 8) - 4;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
};
