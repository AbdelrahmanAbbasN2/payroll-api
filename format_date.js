function formatDate(dateObj) {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const dd = String(dateObj.getDate()).padStart(2, "0");
        const mm = months[dateObj.getMonth()];
        const yyyy = dateObj.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    }