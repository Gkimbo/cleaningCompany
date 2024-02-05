const calculatePrice = (sheets, towels, numBeds, numBaths) => {
	let price = 0;
	if (sheets === "yes") {
		price += 25;
	}
	if (towels === "yes") {
		price += 25;
	}
	if (Number(numBeds) === 1 && Number(numBaths) === 1) {
		price = price + 100;
		return price;
	} else if (Number(numBeds) === 1) {
		const baths = (Number(numBaths) - 1) * 50;
		price += baths + 100;
		return price;
	} else if (Number(numBaths) === 1) {
		const beds = (Number(numBeds) - 1) * 50;
		price += beds + 100;
		return price;
	} else {
		const beds = (Number(numBeds) - 1) * 50;
		const baths = (Number(numBaths) - 1) * 50;
		price += beds + baths + 100;
		return price;
	}
};

module.exports = calculatePrice;
