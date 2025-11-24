const FULL_ANGLE = 2 * Math.PI;

// Image cache to avoid reloading the same image every frame
const imageCache = {};
const imageLoadStatus = {};

const getImageFromCache = (src) => {
    if (!src) return null;
    if (!imageCache[src]) {
        const img = new Image();
        img.onload = function() {
            imageLoadStatus[src] = 'loaded';
        };
        img.onerror = function() {
            imageLoadStatus[src] = 'error';
            console.error('[SKIN] Failed to load skin image');
        };
        img.src = src;
        imageCache[src] = img;
        imageLoadStatus[src] = 'loading';
    }
    return imageCache[src];
};

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawFood = (position, food, graph) => {
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth = 0;
    drawRoundObject(position, food.radius, graph);
};

const drawVirus = (position, virus, graph) => {
    graph.strokeStyle = virus.stroke;
    graph.fillStyle = virus.fill;
    graph.lineWidth = virus.strokeWidth;
    let theta = 0;
    let sides = 20;

    graph.beginPath();
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / sides) {
        let point = circlePoint(position, virus.radius, theta);
        graph.lineTo(point.x, point.y);
    }
    graph.closePath();
    graph.stroke();
    graph.fill();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value))

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta)
});

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y)
});

const drawCellWithLines = (cell, borders, graph) => {
    let pointCount = 30 + ~~(cell.mass / 5);
    let points = [];
    let time = Date.now() / 200; // speed of wobble

    for (let i = 0; i < pointCount; i++) {
        let theta = (i / pointCount) * FULL_ANGLE;

        // Oscillate radius to create "alive" effect
        let wobble = Math.sin(time + i) * (cell.radius * 0.05); // 5% of radius
        let r = cell.radius + wobble;

        let point = {
            x: cell.x + r * Math.cos(theta),
            y: cell.y + r * Math.sin(theta)
        };
        points.push(regulatePoint(point, borders));
    }

    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        graph.lineTo(points[i].x, points[i].y);
    }
    graph.closePath();
    graph.fill();
    graph.stroke();
};
const drawCashoutIndicator = (cell, graph) => {
    // Draw the exact same circle loading animation as the UI button
    // Uses the same proportions and animation as the SVG progressCircle
    const now = Date.now();
    const radius = cell.radius + 20;
    const strokeWidth = 4;
    const HOLD_TIME = 3000; // 3 seconds
    
    // Get the hold start time from the cell data
    const holdStartTime = cell.holdStartTime;
    if (!holdStartTime) return; // Safety check
    
    // Calculate exact progress just like the UI button does
    const elapsed = now - holdStartTime;
    const progress = Math.min(elapsed / HOLD_TIME, 1);
    
    // Use the exact same circumference calculation as the UI (113.097 for radius 18)
    const circumference = 2 * Math.PI * radius;
    const dashOffset = 113.097 * (1 - progress); // Scale proportionally
    const scaledOffset = dashOffset * (circumference / 113.097);
    
    // Draw background circle (light gray)
    graph.strokeStyle = '#cccccc';
    graph.lineWidth = strokeWidth;
    graph.globalAlpha = 0.3;
    graph.beginPath();
    graph.arc(cell.x, cell.y, radius, 0, FULL_ANGLE);
    graph.stroke();
    
    // Draw progress circle (purple with animated dash)
    graph.globalAlpha = 1;
    graph.strokeStyle = '#8e6fff';
    graph.lineWidth = strokeWidth;
    graph.lineCap = 'round';
    graph.beginPath();
    graph.setLineDash([circumference, circumference]);
    graph.lineDashOffset = -scaledOffset;
    graph.arc(cell.x, cell.y, radius, 0, FULL_ANGLE);
    graph.stroke();
    graph.setLineDash([]); // Reset line dash
    graph.globalAlpha = 1;
};

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        // If the cell has a custom skin image, draw it; otherwise use the default color
        if (cell.skinImage) {
            const img = getImageFromCache(cell.skinImage);
            const loadStatus = imageLoadStatus[cell.skinImage];
            
            if (loadStatus === 'loaded' || (img && img.complete && img.naturalWidth > 0)) {
                // Image is loaded, draw it
                graph.save();
                graph.beginPath();
                graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
                graph.clip();
                graph.drawImage(img, cell.x - cell.radius, cell.y - cell.radius, cell.radius * 2, cell.radius * 2);
                graph.restore();
                
                // Draw border around skin
                graph.strokeStyle = cell.borderColor;
                graph.lineWidth = 6;
                graph.beginPath();
                graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
                graph.stroke();
            } else {
                // Image not loaded yet, fall back to color
                graph.fillStyle = cell.color;
                graph.strokeStyle = cell.borderColor;
                graph.lineWidth = 6;
                graph.beginPath();
                graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
                graph.fill();
                graph.stroke();
            }
        } else {
            // Default drawing behavior
            graph.fillStyle = cell.color;
            graph.strokeStyle = cell.borderColor;
            graph.lineWidth = 6;

            // Draw the cell with wobble if not touching borders
            if (cellTouchingBorders(cell, borders)) {
                drawCellWithLines(cell, borders, graph);
            } else {
                // Apply wobble even for round cells
                const time = Date.now() / 200;
                const points = 30;
                graph.beginPath();
                for (let i = 0; i <= points; i++) {
                    let theta = (i / points) * FULL_ANGLE;
                    let wobble = Math.sin(time + i) * (cell.radius * 0.05); // 5% radius
                    let r = cell.radius + wobble;
                    let px = cell.x + r * Math.cos(theta);
                    let py = cell.y + r * Math.sin(theta);
                    if (i === 0) graph.moveTo(px, py);
                    else graph.lineTo(px, py);
                }
                graph.closePath();
                graph.fill();
                graph.stroke();
            }
        }

        // Draw cashout indicator if player is cashing out
        if (cell.isCashingOut) {
            drawCashoutIndicator(cell, graph);
        }

        // Draw the name and balance
        let fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = '#FFFFFF';
        graph.strokeStyle = '#000000';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';

        let displayText = cell.name + ` ($${cell.displayBalance.toFixed(2)})`;
        graph.strokeText(displayText, cell.x, cell.y);
        graph.fillText(displayText, cell.x, cell.y);

        // Draw mass if enabled
        if (toggleMassState === 1) {
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();

    for (let x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (let y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
};

const drawBorder = (borders, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = '#000000'
    graph.beginPath()
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath()
    graph.stroke();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
}

module.exports = {
    drawFood,
    drawVirus,
    drawFireFood,
    drawCells,
    drawErrorMessage,
    drawGrid,
    drawBorder
};