const page = document.querySelector(".auth-page");

if (page) {
    const canvas = document.createElement("canvas");
    canvas.className = "auth-mesh";
    canvas.setAttribute("aria-hidden", "true");
    page.prepend(canvas);

    const ctx = canvas.getContext("2d");

    if (ctx) {
        const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        const spacing = 34;
        const mouseRadius = 145;
        const points = [];

        let width = 0;
        let height = 0;
        let columns = 0;
        let pointer = {
            x: -1000,
            y: -1000,
            active: false
        };
        let animationFrame = null;

        function createPoints() {
            points.length = 0;

            columns = Math.ceil(width / spacing) + 1;
            const rows = Math.ceil(height / spacing) + 1;

            for (let row = 0; row < rows; row++) {
                for (let column = 0; column < columns; column++) {
                    const baseX = column * spacing;
                    const baseY = row * spacing;

                    points.push({
                        x: baseX,
                        y: baseY,
                        baseX,
                        baseY,
                        row,
                        column,
                        phase: Math.random() * Math.PI * 2
                    });
                }
            }
        }

        function resizeCanvas() {
            const rect = page.getBoundingClientRect();
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

            width = rect.width;
            height = rect.height;

            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

            createPoints();
            draw();
        }

        function drawConnections() {
            for (const point of points) {
                const neighbors = [
                    points.find(
                        other =>
                            other.row === point.row &&
                            other.column === point.column + 1
                    ),
                    points.find(
                        other =>
                            other.row === point.row + 1 &&
                            other.column === point.column
                    ),
                    points.find(
                        other =>
                            other.row === point.row + 1 &&
                            other.column === point.column + 1
                    ),
                    points.find(
                        other =>
                            other.row === point.row + 1 &&
                            other.column === point.column - 1
                    )
                ];

                for (const other of neighbors) {
                    if (!other) continue;

                    const distance = Math.hypot(
                        point.x - other.x,
                        point.y - other.y
                    );

                    const opacity = Math.max(
                        0,
                        0.17 * (1 - distance / (spacing * 1.7))
                    );

                    ctx.beginPath();
                    ctx.moveTo(point.x, point.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.strokeStyle = `rgba(112, 130, 160, ${opacity})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }
        }

        function drawPoints() {
            for (const point of points) {
                const distanceToPointer = Math.hypot(
                    point.x - pointer.x,
                    point.y - pointer.y
                );

                const nearby =
                    pointer.active && distanceToPointer < mouseRadius;

                ctx.beginPath();
                ctx.arc(
                    point.x,
                    point.y,
                    nearby ? 2 : 1.25,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle = nearby
                    ? "rgba(75, 105, 160, 0.8)"
                    : "rgba(112, 130, 160, 0.45)";

                ctx.fill();
            }
        }

        function updatePoints() {
            for (const point of points) {
                let targetX = point.baseX;
                let targetY = point.baseY;

                if (pointer.active) {
                    const dx = point.x - pointer.x;
                    const dy = point.y - pointer.y;
                    const distance = Math.hypot(dx, dy);

                    if (distance < mouseRadius && distance > 0) {
                        const strength =
                            (1 - distance / mouseRadius) * 24;

                        targetX += (dx / distance) * strength;
                        targetY += (dy / distance) * strength;
                    }
                }

                point.x += (targetX - point.x) * 0.12;
                point.y += (targetY - point.y) * 0.12;
            }
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);

            if (!reduceMotion) {
                updatePoints();
            }

            drawConnections();
            drawPoints();

            if (!reduceMotion) {
                animationFrame = requestAnimationFrame(draw);
            }
        }

        page.addEventListener("pointermove", event => {
            const rect = canvas.getBoundingClientRect();

            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
            pointer.active = true;

            if (reduceMotion) {
                draw();
            }
        });

        page.addEventListener("pointerleave", () => {
            pointer.active = false;

            if (reduceMotion) {
                draw();
            }
        });

        window.addEventListener("resize", resizeCanvas);

        resizeCanvas();

        if (!reduceMotion && animationFrame === null) {
            animationFrame = requestAnimationFrame(draw);
        }
    }
}