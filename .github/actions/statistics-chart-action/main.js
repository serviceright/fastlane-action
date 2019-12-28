const core = require('@actions/core');
const {Firestore, DocumentSnapshot} = require('@google-cloud/firestore');

class ActionRun {
    constructor(createdAt, repository, runnerOS, usesOptions, usesSubdirectory, usesBundleInstallPath) {
        this.createdAt = createdAt;
        this.repository = repository;
        this.runnerOS = runnerOS;
        this.usesOptions = usesOptions;
        this.usesSubdirectory = usesSubdirectory;
        this.usesBundleInstallPath = usesBundleInstallPath;
    }
}

function run() {
    try {
        const firebaseServiceAccountEmail = core.getInput('firebase-service-account-email', { required: true });
        const firebaseServiceAccountPrivateKey = core.getInput('firebase-service-account-private-key', { required: true });

        const firestore = new Firestore({
            projectId: 'github-fastlane-action',
            credentials: {
                client_email: firebaseServiceAccountEmail,
                private_key: firebaseServiceAccountPrivateKey
            }
        });

        firestore
            .collection('action-runs')
            .orderBy("created", "asc")
            .listDocuments()
            .then(documentRefs => {
                return firestore.getAll(...documentRefs);
            })
            .then(documentSnapshots => {
                generateChartImage(documentSnapshots.map(docSnapshot => {
                    const data = docSnapshot.data();
                    return new ActionRun(data.created.toDate(), data.repository, data.runnerOS, data.usesOptions, data.usesSubdirectory, data.usesBundleInstallPath);
                }));
            });
    } catch (error) {
        setFailed(error);
    }
}

function generateChartImage(actionRuns) {
    let processedMonths = new Set();
    let uniqueRepositories = new Set();

    let values = [];

    for (let actionRun in actionRuns) {
        let monthName = actionRun.createdAt.toLocaleDateString("en-US", { month: "numeric", year: "numeric" });

        if (processedMonths.length > 0 && !processedMonths.includes(monthName)) {
            values.push({
                x: monthName,
                y: uniqueRepositories.length,
                c: 0
            });
        }

        processedMonths.add(monthName);
        uniqueRepositories.add(actionRun.repository);
    }

    const vega = require('vega');
    const fs = require('fs');
    let spec = require('vega-specs/unique-repositories');

    spec.data[0].values = values;

    const view = new vega.View(vega.parse(spec), {renderer: 'none'});

    view.toCanvas()
        .then(function(canvas) {
            canvas.createPNGStream().pipe(fs.createWriteStream('chart-output/unique-repositories.png'));
        })
        .catch(function(err) {
            setFailed(err);
        });

}

function setFailed(error) {
    core.error(error);
    core.setFailed(error.message);
}

run();