const navtoggle =document.querySelector('.nav-toggle');
const navlinks =document.querySelectorAll('.nav__link');


navtoggle.addEventListener('click' ,() =>{
   document.body.classList.toggle('nav-open');
});




navlinks.forEach(link => {
    link.addEventListener('click',() =>{
        document.body.classList.remove('nav-open');
    })
});
