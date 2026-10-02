<!DOCTYPE html>
<html>
<head>
    <title>Transaction Completed</title>
</head>
<body>
    <h1>Transaction Completed Successfully</h1>
    <p>Dear Customer,</p>
    <p>Your transaction has been completed successfully. Here are the details:</p>
    <ul>
        <li>Transaction ID: {{ $transaction->id }}</li>
        <li>Amount Sent: {{ $transaction->amount_sent }}</li>
        <li>Recipient Channel: {{ $transaction->recipient_channel }}</li>
        <li>Transaction Date: {{ $transaction->transaction_date }}</li>
    </ul>
    <p>Thank you for using our service.</p>
</body>
</html>