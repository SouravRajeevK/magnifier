document.addEventListener("DOMContentLoaded", function () {
    let scaleFactor = 1; // Initial zoom level
    let scrollInterval = null;

    document.addEventListener("mousemove", function (e) {
        const xPercent = (e.clientX / window.innerWidth) * 100;
        const yPercent = (e.clientY / window.innerHeight) * 100;
        document.body.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        document.body.style.transform = `scale(${scaleFactor})`;

        // Edge scrolling logic
        const minEdgeThreshold = 50; // Start slow scroll here
        const maxEdgeThreshold = 20; // Faster scroll near absolute edges

        // Determine scroll speed based on proximity to edge
        function getScrollSpeed(distance) {
            if (distance <= maxEdgeThreshold) return 8;  // Fastest scroll
            if (distance <= minEdgeThreshold) return 4;  // Slower scroll
            return 0;
        }

        clearInterval(scrollInterval);

        if (e.clientX <= minEdgeThreshold) {
            scrollInterval = setInterval(() => window.scrollBy(-getScrollSpeed(e.clientX), 0), 10);
        } else if (e.clientX >= window.innerWidth - minEdgeThreshold) {
            let distanceToEdge = window.innerWidth - e.clientX;
            scrollInterval = setInterval(() => window.scrollBy(getScrollSpeed(distanceToEdge), 0), 10);
        } else if (e.clientY <= minEdgeThreshold) {
            scrollInterval = setInterval(() => window.scrollBy(0, -getScrollSpeed(e.clientY)), 10);
        } else if (e.clientY >= window.innerHeight - minEdgeThreshold) {
            let distanceToEdge = window.innerHeight - e.clientY;
            scrollInterval = setInterval(() => window.scrollBy(0, getScrollSpeed(distanceToEdge)), 10);
        }
    });

    document.addEventListener("mouseleave", function () {
        clearInterval(scrollInterval);
    });

    document.addEventListener("wheel", function (e) {
        e.preventDefault();
        scaleFactor += e.deltaY * -0.001; // Adjust zoom speed
        scaleFactor = Math.min(Math.max(1, scaleFactor), 3); // Limit zoom range
        document.body.style.transform = `scale(${scaleFactor})`;
    }, { passive: false });
});
