// Make sure GSAP is available
document.addEventListener("DOMContentLoaded", () => {
    console.log("GSAP and Waterfall Animation Loaded!");

    // Waterfall animation
    gsap.to(".waterfall", {
        duration: 4, // Time it takes for the waterfall to move down
        y: "100%",  // Move the waterfall down
        repeat: -1, // Repeat infinitely
        yoyo: true, // Reverse the animation when it finishes
        ease: "linear", // Smooth constant movement
    });

    // Splash effect - Create dynamic water particles using GSAP
    setInterval(() => {
        createSplashEffect();
    }, 100); // Create a new splash every 100ms
});

// Function to create a splash effect
function createSplashEffect() {
    const splash = document.createElement("div");
    splash.classList.add("waterfall-splash");
    document.querySelector(".waterfall-container").appendChild(splash);

    // Use GSAP to animate the splash
    gsap.fromTo(splash, {
        scale: 0,
        opacity: 1,
        y: 0,
    }, {
        scale: 1.5,
        opacity: 0,
        y: -20,
        duration: 0.6,
        ease: "power1.out",
        onComplete: () => {
            splash.remove(); // Remove the splash after animation
        }
    });
}
