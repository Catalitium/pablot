const num1Input = document.getElementById('num1');
const num2Input = document.getElementById('num2');
const operatorButtons = document.querySelectorAll('.operator');
const resultDisplay = document.getElementById('result');

function getNumbers() {
    const num1 = parseFloat(num1Input.value);
    const num2 = parseFloat(num2Input.value);

    if (num1Input.value === '' || num2Input.value === '') {
        return null;
    }

    if (isNaN(num1) || isNaN(num2)) {
        return null;
    }

    if (!isFinite(num1) || !isFinite(num2)) {
        return null;
    }

    return { num1, num2 };
}

function calculate(operator) {
    const numbers = getNumbers();

    if (!numbers) {
        resultDisplay.textContent = 'Please enter valid numbers';
        resultDisplay.classList.add('error');
        return;
    }

    const { num1, num2 } = numbers;
    let result;

    switch (operator) {
        case '+':
            result = num1 + num2;
            break;
        case '-':
            result = num1 - num2;
            break;
        case '*':
            result = num1 * num2;
            break;
        case '/':
            if (num2 === 0) {
                resultDisplay.textContent = 'Cannot divide by zero';
                resultDisplay.classList.add('error');
                return;
            }
            result = num1 / num2;
            break;
        default:
            resultDisplay.textContent = 'Invalid operation';
            resultDisplay.classList.add('error');
            return;
    }

    resultDisplay.textContent = result;
    resultDisplay.classList.remove('error');
}

operatorButtons.forEach(button => {
    button.addEventListener('click', () => {
        const operator = button.value;
        calculate(operator);
    });
});

num1Input.addEventListener('input', () => {
    resultDisplay.textContent = '';
    resultDisplay.classList.remove('error');
});

num2Input.addEventListener('input', () => {
    resultDisplay.textContent = '';
    resultDisplay.classList.remove('error');
});