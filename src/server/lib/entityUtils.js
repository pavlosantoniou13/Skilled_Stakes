const util = require("./util");

function getPosition(isUniform, radius, uniformPositions) {
    return isUniform ? util.uniformPosition(uniformPositions, radius) : util.randomPosition(radius);
}

function isVisibleEntity(entity, player, addThreshold = true) {
    const entityHalfSize = entity.radius + (addThreshold ? entity.radius * 0.1 : 0);
    // When zoomed out (cameraScale < 1), expand visibility radius so more entities are sent
    // When zoomed in (cameraScale > 1), shrink visibility radius for optimization
    const cameraScale = player.cameraScale || 1.0;
    const baseRadius = player.screenWidth / 2;
    const adjustedRadius = baseRadius / cameraScale; // Larger radius when zoomed out
    return util.testRectangleRectangle(
        entity.x, entity.y, entityHalfSize, entityHalfSize,
        player.x, player.y, adjustedRadius, adjustedRadius);
}

module.exports = {
    getPosition,
    isVisibleEntity
}
